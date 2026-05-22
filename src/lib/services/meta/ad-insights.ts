import {
  fetchAdImageUrlsByHash,
  fetchAdVideoPicturesById,
  pickDisplayImageUrl,
  resolveCreativeMediaUrls,
} from "./creative-media"
import { fetchVideoSourcesByIds } from "./creative-video-source"
import { hasAdDeliveryInPeriod } from "./ad-insights-filter"
import { fetchPurchaseGenderByAdId } from "./purchase-gender"
import { extractCreativeDestinationUrl } from "./creative-url"
import { extractVideoIdFromCreative } from "./extract-video-id"
import { getMetaClient } from "./meta"
import { buildMetaGraphUrl } from "./meta-graph-fetch"
import { metaGraphGet } from "./meta-graph-retry"
import { withMetaCache } from "./meta-cache"
import type {
  AdInsightRow,
  DateRange,
  MetaAdCreative,
  MetaAdInsightsResponse,
} from "./types"

const AD_INSIGHTS_TTL_MS = 2 * 60 * 1000

export async function getAdInsights(
  dateRange: DateRange
): Promise<AdInsightRow[]> {
  const cacheKey = `ad-insights:v2:${dateRange.from}:${dateRange.to}`
  return withMetaCache(cacheKey, AD_INSIGHTS_TTL_MS, () =>
    fetchAdInsights(dateRange)
  )
}

async function fetchAdInsights(dateRange: DateRange): Promise<AdInsightRow[]> {
  const api = getMetaClient()
  const timeRange = JSON.stringify({
    since: dateRange.from,
    until: dateRange.to,
  })

  // 1. Fetch insights at ad level
  const insights: any[] = []
  let response = await api.get<MetaAdInsightsResponse>("/insights", {
    params: {
      level: "ad",
      fields: [
        "ad_name",
        "ad_id",
        "adset_name",
        "adset_id",
        "campaign_name",
        "campaign_id",
        "spend",
        "impressions",
        "reach",
        "frequency",
        "clicks",
        "ctr",
        "cpc",
        "cpm",
        "actions",
        "action_values",
        "cost_per_action_type",
        "purchase_roas",
      ].join(","),
      time_range: timeRange,
      limit: "500",
    },
  })

  insights.push(...response.data.data)

  let nextUrl = response.data.paging?.next
  while (nextUrl) {
    const nextResponse = await metaGraphGet<MetaAdInsightsResponse>(nextUrl)
    insights.push(...(nextResponse.data ?? []))
    nextUrl = nextResponse.paging?.next
  }

  if (insights.length === 0) return []

  const genderPromise = fetchPurchaseGenderByAdId(dateRange).catch((error) => {
    console.error("Error fetching gender purchase breakdown:", error)
    return new Map<string, { male: number; female: number; unknown: number }>()
  })

  // 2. Fetch creative metadata in batches of 50
  const adIds = [...new Set(insights.map((r) => r.ad_id).filter(Boolean))]
  const creativeMap = new Map<string, MetaAdCreative>()
  const statusMap = new Map<string, string>()
  const createdTimeMap = new Map<string, string>()
  const urlMap = new Map<string, string>()
  const videoIdMap = new Map<string, string>()

  const CREATIVE_FIELDS =
    "id,effective_status,created_time,creative{id,thumbnail_url,image_url,image_hash,video_id,link_url,object_url," +
    "object_story_spec{photo_data{url,image_hash},video_data{video_id,image_url,call_to_action{value{link}}}," +
    "link_data{picture,image_url,link,call_to_action{value{link}},child_attachments{link}},template_data{link}}," +
    "asset_feed_spec{link_urls{website_url},videos{video_id}}}"
  const BATCH_SIZE = 25
  const BATCH_DELAY_MS = 600

  const token = process.env.META_ACCESS_TOKEN

  for (let i = 0; i < adIds.length; i += BATCH_SIZE) {
    const chunk = adIds.slice(i, i + BATCH_SIZE)
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS))
    }
    try {
      const data = token
        ? await metaGraphGet<Record<string, unknown>>(
            buildMetaGraphUrl("", {
              ids: chunk.join(","),
              fields: CREATIVE_FIELDS,
            })
          )
        : {}

      for (const [id, ad] of Object.entries(data) as [string, any][]) {
        statusMap.set(id, ad.effective_status || "")
        if (ad.created_time) {
          createdTimeMap.set(id, ad.created_time)
        }
        if (ad.creative?.id) {
          creativeMap.set(id, ad.creative as MetaAdCreative)
        }

        urlMap.set(id, extractCreativeDestinationUrl(ad.creative))

        const vId = extractVideoIdFromCreative(ad.creative)
        if (vId) videoIdMap.set(id, vId)
      }
    } catch (error) {
      console.error("Error fetching creative metadata batch:", error)
    }
  }

  const imageHashes = [...creativeMap.values()].flatMap((creative) => {
    const hashes: string[] = []
    if (creative.image_hash) hashes.push(creative.image_hash)
    const specHash = creative.object_story_spec?.photo_data?.image_hash
    if (specHash) hashes.push(specHash)
    return hashes
  })

  const videoIds = [...new Set(videoIdMap.values())]
  let videoUrlMap = new Map<string, string>()
  let imageHashMap = new Map<string, string>()
  let videoPictureMap = new Map<string, string>()

  try {
    const [hashUrls, pictures, sources] = await Promise.all([
      fetchAdImageUrlsByHash(imageHashes),
      fetchAdVideoPicturesById(videoIds),
      videoIds.length > 0
        ? fetchVideoSourcesByIds(videoIds)
        : Promise.resolve(new Map<string, string>()),
    ])
    imageHashMap = hashUrls
    videoPictureMap = pictures
    videoUrlMap = sources
  } catch (error) {
    console.error("Error fetching creative media:", error)
  }

  const genderByAdId = await genderPromise

  const rows = insights.map((r) => {
    const adId = r.ad_id
    const vId = videoIdMap.get(adId)
    const creative = creativeMap.get(adId)
    const media = creative
      ? resolveCreativeMediaUrls(creative, imageHashMap, videoPictureMap)
      : { thumbnailUrl: "", imageUrl: undefined }

    const displayUrl = pickDisplayImageUrl(media.thumbnailUrl, media.imageUrl)

    return {
      ...r,
      thumbnail_url: displayUrl,
      image_url: media.imageUrl || displayUrl,
      video_url: vId ? videoUrlMap.get(vId) || "" : "",
      video_id: vId || "",
      effective_status: statusMap.get(adId) || "",
      url: urlMap.get(adId) || "",
      created_time: createdTimeMap.get(adId) || "",
      purchasesByGender: genderByAdId.get(adId),
    } as AdInsightRow
  })

  return rows.filter(hasAdDeliveryInPeriod)
}
