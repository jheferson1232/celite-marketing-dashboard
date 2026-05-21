import type { AdInsightRow, DateRange, MetaAction } from "@/lib/services/meta/types"
import {
  AD_METRICS,
  fetchIntegratedReport,
  getComments,
  getMetricNumber,
  getPurchases,
} from "./report"
import { fetchAllPages } from "./fetch-all-pages"
import {
  getTikTokLandingPageUrl,
  resolveTikTokLandingPageUrl,
} from "./landing-page-url"
import { getTikTokAdvertiserId, getTikTokClient } from "./tiktok"
import { withTikTokCache } from "./tiktok-cache"
import { fetchTikTokPurchaseGenderByAdId } from "./purchase-gender"
import type {
  TikTokAd,
  TikTokAdGroup,
  TikTokAdImage,
  TikTokAdVideo,
  TikTokApiResponse,
} from "./types"

const AD_INSIGHTS_TTL_MS = 2 * 60 * 1000

function buildActions(purchases: number, comments: number): MetaAction[] {
  const actions: MetaAction[] = []
  if (purchases > 0) {
    actions.push({
      action_type: "complete_payment",
      value: String(purchases),
    })
  }
  if (comments > 0) {
    actions.push({ action_type: "comment", value: String(comments) })
  }
  return actions
}

async function fetchImageUrls(imageIds: string[]): Promise<Map<string, string>> {
  if (imageIds.length === 0) return new Map()

  const api = getTikTokClient()
  const advertiserId = getTikTokAdvertiserId()
  const map = new Map<string, string>()
  const BATCH = 100

  for (let i = 0; i < imageIds.length; i += BATCH) {
    const chunk = imageIds.slice(i, i + BATCH)
    try {
      const { data } = await api.get<
        TikTokApiResponse<{ list: TikTokAdImage[] }>
      >("/file/image/ad/info/", {
        params: {
          advertiser_id: advertiserId,
          image_ids: JSON.stringify(chunk),
        },
      })

      for (const image of data.data.list ?? []) {
        if (image.image_url) {
          map.set(image.image_id, image.image_url)
        }
      }
    } catch (error) {
      console.error("Error fetching TikTok image URLs:", error)
    }
  }

  return map
}

async function fetchVideoCovers(videoIds: string[]): Promise<Map<string, string>> {
  if (videoIds.length === 0) return new Map()

  const api = getTikTokClient()
  const advertiserId = getTikTokAdvertiserId()
  const map = new Map<string, string>()
  const BATCH = 60

  for (let i = 0; i < videoIds.length; i += BATCH) {
    const chunk = videoIds.slice(i, i + BATCH)
    try {
      const { data } = await api.get<
        TikTokApiResponse<{ list: TikTokAdVideo[] }>
      >("/file/video/ad/info/", {
        params: {
          advertiser_id: advertiserId,
          video_ids: JSON.stringify(chunk),
        },
      })

      for (const video of data.data.list ?? []) {
        const cover = video.video_cover_url || video.poster_url
        if (cover) {
          map.set(video.video_id, cover)
        }
      }
    } catch (error) {
      console.error("Error fetching TikTok video covers:", error)
    }
  }

  return map
}

export async function getTikTokAdInsights(
  dateRange: DateRange
): Promise<AdInsightRow[]> {
  const cacheKey = `tiktok-ad-insights:${dateRange.from}:${dateRange.to}`
  return withTikTokCache(cacheKey, AD_INSIGHTS_TTL_MS, () =>
    fetchTikTokAdInsights(dateRange)
  )
}

async function fetchTikTokAdInsights(
  dateRange: DateRange
): Promise<AdInsightRow[]> {
  const [reportRows, ads, adGroups] = await Promise.all([
    fetchIntegratedReport(
      "AUCTION_AD",
      ["ad_id"],
      [...AD_METRICS],
      dateRange.from,
      dateRange.to
    ),
    fetchAllPages<TikTokAd>("/ad/get/"),
    fetchAllPages<TikTokAdGroup>("/adgroup/get/"),
  ])
  const adsById = new Map(ads.map((ad) => [ad.ad_id, ad]))
  const adGroupById = new Map(
    adGroups.map((ag) => [ag.adgroup_id, ag] as const)
  )

  const purchasesByAdId = new Map<string, number>()
  for (const row of reportRows) {
    const adId = row.dimensions.ad_id
    if (!adId) continue
    purchasesByAdId.set(adId, getPurchases(row.metrics))
  }

  const genderByAdId = await fetchTikTokPurchaseGenderByAdId(
    dateRange,
    purchasesByAdId
  ).catch((error) => {
    console.error("Error fetching TikTok gender audience breakdown:", error)
    return new Map<string, { male: number; female: number; unknown: number }>()
  })

  const imageIds = [
    ...new Set(
      ads.flatMap((ad) => ad.image_ids ?? []).filter(Boolean)
    ),
  ]
  const videoIds = [
    ...new Set(ads.map((ad) => ad.video_id).filter((id): id is string => !!id)),
  ]

  const [imageMap, videoMap] = await Promise.all([
    fetchImageUrls(imageIds),
    fetchVideoCovers(videoIds),
  ])

  return reportRows
    .map((row) => {
      const adId = row.dimensions.ad_id
      const ad = adsById.get(adId)
      const adGroup = ad?.adgroup_id
        ? adGroupById.get(ad.adgroup_id)
        : undefined
      const metrics = row.metrics
      const spend = getMetricNumber(metrics, "spend")
      const impressions = getMetricNumber(metrics, "impressions")
      const clicks = getMetricNumber(metrics, "clicks")
      const purchases = getPurchases(metrics)
      const comments = getComments(metrics)

      const imageUrl =
        ad?.image_ids?.map((id) => imageMap.get(id)).find(Boolean) ?? ""
      const videoCover = ad?.video_id ? videoMap.get(ad.video_id) : ""
      const thumbnail = videoCover || imageUrl

      return {
        ad_id: adId,
        ad_name: ad?.ad_name || `Anuncio ${adId}`,
        campaign_id: ad?.campaign_id,
        campaign_name: ad?.campaign_name?.trim() || undefined,
        adset_id: ad?.adgroup_id,
        adset_name: adGroup?.adgroup_name?.trim() || undefined,
        spend: String(spend),
        impressions: String(impressions),
        reach: String(getMetricNumber(metrics, "reach")),
        frequency: String(getMetricNumber(metrics, "frequency")),
        clicks: String(clicks),
        ctr: String(getMetricNumber(metrics, "ctr")),
        cpc: String(getMetricNumber(metrics, "cpc")),
        cpm: String(getMetricNumber(metrics, "cpm")),
        actions: buildActions(purchases, comments),
        thumbnail_url: thumbnail,
        image_url: imageUrl || thumbnail,
        video_url: "",
        video_id: ad?.video_id || "",
        effective_status:
          ad?.operation_status === "ENABLE" ? "ACTIVE" : "PAUSED",
        url: resolveTikTokLandingPageUrl(getTikTokLandingPageUrl(ad), {
          campaignId: ad?.campaign_id,
          campaignName: ad?.campaign_name,
          adId: adId,
          adgroupId: ad?.adgroup_id,
        }),
        created_time: ad?.create_time || "",
        purchasesByGender: genderByAdId.get(adId),
      } satisfies AdInsightRow
    })
    .filter((row) => parseFloat(row.spend) > 0)
}
