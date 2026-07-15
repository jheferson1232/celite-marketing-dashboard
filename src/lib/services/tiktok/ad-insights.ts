import type {
  AdInsightRow,
  DateRange,
  MetaAction,
} from "@/lib/services/meta/types"
import { normalizeTikTokMediaUrl } from "@/lib/services/sociavault/tiktok-media-hosts"
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
import {
  buildTikTokCacheKey,
  getTikTokRequestContext,
} from "./tiktok-api.server"
import { withTikTokCache } from "./tiktok-cache"
import { fetchTikTokPurchaseGenderByAdId } from "./purchase-gender"
import type {
  TikTokAd,
  TikTokAdGroup,
  TikTokAdImage,
  TikTokAdVideo,
  TikTokApiResponse,
  TikTokPageInfo,
} from "./types"

const AD_INSIGHTS_TTL_MS = 2 * 60 * 1000

/** Sin `fields`, /ad/get/ omite creativos (video_id, image_ids, tiktok_item_id). */
const AD_GET_FIELDS = JSON.stringify([
  "ad_id",
  "ad_name",
  "campaign_id",
  "campaign_name",
  "adgroup_id",
  "operation_status",
  "create_time",
  "landing_page_url",
  "landing_page_urls",
  "campaign_automation_type",
  "image_ids",
  "video_id",
  "tiktok_item_id",
  "identity_id",
  "identity_type",
  "ad_format",
  "creative_authorized",
])

const VIDEO_INFO_FIELDS = JSON.stringify([
  "video_id",
  "video_cover_url",
  "poster_url",
  "preview_url",
  "video_url",
  "playable_url",
])

const IMAGE_INFO_FIELDS = JSON.stringify(["image_id", "image_url"])

type VideoMedia = {
  coverUrl: string
  previewUrl: string
}

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

async function fetchImageUrls(
  imageIds: string[]
): Promise<Map<string, string>> {
  if (imageIds.length === 0) return new Map()

  const { client: api, advertiserId } = await getTikTokRequestContext()
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
          fields: IMAGE_INFO_FIELDS,
        },
      })

      for (const image of data.data.list ?? []) {
        if (image.image_url) {
          map.set(image.image_id, normalizeTikTokMediaUrl(image.image_url))
        }
      }
    } catch (error) {
      console.error("Error fetching TikTok image URLs:", error)
    }
  }

  return map
}

async function fetchLibraryVideoMedia(
  videoIds: string[]
): Promise<Map<string, VideoMedia>> {
  if (videoIds.length === 0) return new Map()

  const { client: api, advertiserId } = await getTikTokRequestContext()
  const map = new Map<string, VideoMedia>()
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
          fields: VIDEO_INFO_FIELDS,
        },
      })

      for (const video of data.data.list ?? []) {
        const cover =
          video.video_cover_url?.trim() || video.poster_url?.trim() || ""
        const preview =
          video.preview_url?.trim() ||
          video.video_url?.trim() ||
          video.playable_url?.trim() ||
          ""
        if (!cover && !preview) continue
        map.set(video.video_id, {
          coverUrl: cover ? normalizeTikTokMediaUrl(cover) : "",
          previewUrl: preview ? normalizeTikTokMediaUrl(preview) : "",
        })
      }
    } catch (error) {
      console.error("Error fetching TikTok video covers:", error)
    }
  }

  return map
}

type SparkListRow = {
  item_info?: { item_id?: string | number }
  video_info?: {
    poster_url?: string
    video_cover_url?: string
    preview_url?: string
    url?: string
  }
}

/**
 * Spark Ads (AUTH_CODE / TT_USER) suelen traer tiktok_item_id sin video_id.
 * /tt_video/list/ expone poster + preview del post autorizado.
 */
async function fetchSparkItemMedia(
  itemIds: string[]
): Promise<Map<string, VideoMedia>> {
  if (itemIds.length === 0) return new Map()

  const wanted = new Set(itemIds.map((id) => String(id)))
  const map = new Map<string, VideoMedia>()
  const { client: api, advertiserId } = await getTikTokRequestContext()

  let page = 1
  let totalPage = 1
  const MAX_PAGES = 30

  try {
    while (page <= totalPage && page <= MAX_PAGES && map.size < wanted.size) {
      const { data } = await api.get<
        TikTokApiResponse<{ list?: SparkListRow[]; page_info?: TikTokPageInfo }>
      >("/tt_video/list/", {
        params: {
          advertiser_id: advertiserId,
          filtering: JSON.stringify({ item_ids: [...wanted] }),
          page,
          page_size: 50,
        },
      })

      for (const row of data.data.list ?? []) {
        const id = String(row.item_info?.item_id ?? "")
        if (!id || !wanted.has(id) || map.has(id)) continue
        const cover =
          row.video_info?.poster_url?.trim() ||
          row.video_info?.video_cover_url?.trim() ||
          ""
        const preview =
          row.video_info?.preview_url?.trim() ||
          row.video_info?.url?.trim() ||
          ""
        if (!cover && !preview) continue
        map.set(id, {
          coverUrl: cover ? normalizeTikTokMediaUrl(cover) : "",
          previewUrl: preview ? normalizeTikTokMediaUrl(preview) : "",
        })
      }

      totalPage = data.data.page_info?.total_page ?? 1
      page += 1
    }
  } catch (error) {
    console.error("Error fetching TikTok Spark item media:", error)
  }

  return map
}

export async function getTikTokAdInsights(
  dateRange: DateRange
): Promise<AdInsightRow[]> {
  const cacheKey = await buildTikTokCacheKey(
    `ad-insights:v3:${dateRange.from}:${dateRange.to}`
  )
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
    fetchAllPages<TikTokAd>("/ad/get/", { fields: AD_GET_FIELDS }),
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
    ...new Set(ads.flatMap((ad) => ad.image_ids ?? []).filter(Boolean)),
  ]
  const videoIds = [
    ...new Set(ads.map((ad) => ad.video_id).filter((id): id is string => !!id)),
  ]
  const sparkItemIds = [
    ...new Set(
      ads
        .filter((ad) => !ad.video_id && ad.tiktok_item_id)
        .map((ad) => String(ad.tiktok_item_id))
    ),
  ]

  const [imageMap, libraryVideoMap, sparkMap] = await Promise.all([
    fetchImageUrls(imageIds),
    fetchLibraryVideoMedia(videoIds),
    fetchSparkItemMedia(sparkItemIds),
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
      const libraryMedia = ad?.video_id
        ? libraryVideoMap.get(ad.video_id)
        : undefined
      const sparkMedia =
        !ad?.video_id && ad?.tiktok_item_id
          ? sparkMap.get(String(ad.tiktok_item_id))
          : undefined

      const thumbnail =
        libraryMedia?.coverUrl || sparkMedia?.coverUrl || imageUrl || ""
      const videoUrl = libraryMedia?.previewUrl || sparkMedia?.previewUrl || ""
      const videoId = ad?.video_id || ""
      const isVideo = Boolean(
        videoId ||
        videoUrl ||
        ad?.tiktok_item_id ||
        ad?.ad_format === "SINGLE_VIDEO"
      )

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
        video_url: videoUrl,
        // Si es Spark sin video_id de biblioteca, marcamos el item para UI/agrupación.
        video_id:
          videoId ||
          (isVideo && ad?.tiktok_item_id ? `spark:${ad.tiktok_item_id}` : ""),
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
