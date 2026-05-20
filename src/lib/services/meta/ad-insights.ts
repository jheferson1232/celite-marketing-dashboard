import axios from "axios"
import {
  fetchAdImageUrlsByHash,
  fetchAdVideoPicturesById,
  pickDisplayImageUrl,
  resolveCreativeMediaUrls,
} from "./creative-media"
import { fetchVideoSourcesByIds } from "./creative-video-source"
import { extractVideoIdFromCreative } from "./extract-video-id"
import { getMetaClient } from "./meta"
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
  const cacheKey = `ad-insights:${dateRange.from}:${dateRange.to}`
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
      limit: 500,
    },
  })

  insights.push(...response.data.data)

  let nextUrl = response.data.paging?.next
  while (nextUrl) {
    const nextResponse = await axios.get<MetaAdInsightsResponse>(nextUrl)
    insights.push(...nextResponse.data.data)
    nextUrl = nextResponse.data.paging?.next
  }

  if (insights.length === 0) return []

  // 2. Fetch creative metadata in batches of 50
  const adIds = [...new Set(insights.map((r) => r.ad_id).filter(Boolean))]
  const creativeMap = new Map<string, MetaAdCreative>()
  const statusMap = new Map<string, string>()
  const createdTimeMap = new Map<string, string>()
  const urlMap = new Map<string, string>()
  const videoIdMap = new Map<string, string>()

  const CREATIVE_FIELDS =
    "id,effective_status,created_time,creative{id,thumbnail_url,image_url,image_hash,video_id,link_url," +
    "object_story_spec{photo_data{url,image_hash},video_data{video_id,image_url,call_to_action{value{link}}}," +
    "link_data{picture,image_url,link}}," +
    "asset_feed_spec{link_urls{website_url},videos{video_id}}}"
  const BATCH_SIZE = 50

  const token = process.env.META_ACCESS_TOKEN

  for (let i = 0; i < adIds.length; i += BATCH_SIZE) {
    const chunk = adIds.slice(i, i + BATCH_SIZE)
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
    try {
      const { data } = await axios.get(`https://graph.facebook.com/v25.0/`, {
        params: {
          ids: chunk.join(","),
          fields: CREATIVE_FIELDS,
          access_token: token,
        },
      })

      for (const [id, ad] of Object.entries(data) as [string, any][]) {
        statusMap.set(id, ad.effective_status || "")
        if (ad.created_time) {
          createdTimeMap.set(id, ad.created_time)
        }
        if (ad.creative?.id) {
          creativeMap.set(id, ad.creative as MetaAdCreative)
        }

        const spec = ad.creative?.object_story_spec
        const assetFeed = ad.creative?.asset_feed_spec
        const url =
          spec?.link_data?.link ||
          spec?.video_data?.call_to_action?.value?.link ||
          assetFeed?.link_urls?.[0]?.website_url ||
          ad.creative?.link_url ||
          ""
        urlMap.set(id, url)

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

  return insights.map((r) => {
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
    } as AdInsightRow
  })
}
