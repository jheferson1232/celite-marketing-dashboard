import { normalizeTikTokMediaUrl } from "@/lib/services/sociavault/tiktok-media-hosts"
import { fetchAllPages } from "./fetch-all-pages"
import {
  buildTikTokCacheKey,
  getTikTokRequestContext,
} from "./tiktok-api.server"
import { withTikTokCache } from "./tiktok-cache"
import type {
  TikTokAd,
  TikTokAdVideo,
  TikTokApiResponse,
  TikTokPageInfo,
} from "./types"

const THUMBNAILS_TTL_MS = 5 * 60 * 1000

const AD_FIELDS = JSON.stringify([
  "ad_id",
  "ad_name",
  "video_id",
  "image_ids",
  "tiktok_item_id",
  "ad_format",
])

/** Solo covers/posters — sin preview_url ni video_url (pesados). */
const VIDEO_COVER_FIELDS = JSON.stringify([
  "video_id",
  "video_cover_url",
  "poster_url",
])

const IMAGE_FIELDS = JSON.stringify(["image_id", "image_url"])

export type TikTokCampaignVideoThumbnail = {
  id: string
  name: string
  thumbnailUrl: string
}

async function fetchCoverByVideoIds(
  videoIds: string[]
): Promise<Map<string, string>> {
  if (videoIds.length === 0) return new Map()

  const { client: api, advertiserId } = await getTikTokRequestContext()
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
          fields: VIDEO_COVER_FIELDS,
        },
      })

      for (const video of data.data.list ?? []) {
        const cover =
          video.video_cover_url?.trim() || video.poster_url?.trim() || ""
        if (!cover) continue
        map.set(video.video_id, normalizeTikTokMediaUrl(cover))
      }
    } catch (error) {
      console.error("Error fetching TikTok campaign video covers:", error)
    }
  }

  return map
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
        TikTokApiResponse<{
          list: { image_id: string; image_url?: string }[]
        }>
      >("/file/image/ad/info/", {
        params: {
          advertiser_id: advertiserId,
          image_ids: JSON.stringify(chunk),
          fields: IMAGE_FIELDS,
        },
      })

      for (const image of data.data.list ?? []) {
        if (image.image_url) {
          map.set(image.image_id, normalizeTikTokMediaUrl(image.image_url))
        }
      }
    } catch (error) {
      console.error("Error fetching TikTok campaign image covers:", error)
    }
  }

  return map
}

type SparkListRow = {
  item_info?: { item_id?: string | number }
  video_info?: {
    poster_url?: string
    video_cover_url?: string
  }
}

async function fetchSparkCovers(
  itemIds: string[]
): Promise<Map<string, string>> {
  if (itemIds.length === 0) return new Map()

  const wanted = new Set(itemIds.map((id) => String(id)))
  const map = new Map<string, string>()
  const { client: api, advertiserId } = await getTikTokRequestContext()

  let page = 1
  let totalPage = 1
  const MAX_PAGES = 20

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
        if (!cover) continue
        map.set(id, normalizeTikTokMediaUrl(cover))
      }

      totalPage = data.data.page_info?.total_page ?? 1
      page += 1
    }
  } catch (error) {
    console.error("Error fetching TikTok Spark covers:", error)
  }

  return map
}

async function fetchCampaignVideoThumbnailsUncached(
  campaignId: string
): Promise<TikTokCampaignVideoThumbnail[]> {
  const ads = await fetchAllPages<TikTokAd>("/ad/get/", {
    fields: AD_FIELDS,
    filtering: JSON.stringify({ campaign_ids: [campaignId] }),
  })

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
  const imageIds = [
    ...new Set(ads.flatMap((ad) => ad.image_ids ?? []).filter(Boolean)),
  ]

  const [videoCovers, sparkCovers, imageUrls] = await Promise.all([
    fetchCoverByVideoIds(videoIds),
    fetchSparkCovers(sparkItemIds),
    fetchImageUrls(imageIds),
  ])

  const byKey = new Map<string, TikTokCampaignVideoThumbnail>()

  for (const ad of ads) {
    let id = ""
    let thumbnailUrl = ""

    if (ad.video_id) {
      id = ad.video_id
      thumbnailUrl = videoCovers.get(ad.video_id) ?? ""
    } else if (ad.tiktok_item_id) {
      id = `spark:${ad.tiktok_item_id}`
      thumbnailUrl = sparkCovers.get(String(ad.tiktok_item_id)) ?? ""
    }

    if (!thumbnailUrl && ad.image_ids?.length) {
      thumbnailUrl =
        ad.image_ids.map((imageId) => imageUrls.get(imageId)).find(Boolean) ??
        ""
      if (!id) id = `img:${ad.ad_id}`
    }

    if (!thumbnailUrl || !id || byKey.has(id)) continue

    byKey.set(id, {
      id,
      name: ad.ad_name?.trim() || `Anuncio ${ad.ad_id}`,
      thumbnailUrl,
    })
  }

  return [...byKey.values()]
}

/** Miniaturas (solo imágenes cover) de creativos de una campaña TikTok. */
export async function getTikTokCampaignVideoThumbnails(
  campaignId: string
): Promise<TikTokCampaignVideoThumbnail[]> {
  const id = campaignId.trim()
  if (!id) return []

  const cacheKey = await buildTikTokCacheKey(
    `campaign-video-thumbs:v1:${id}`
  )
  return withTikTokCache(cacheKey, THUMBNAILS_TTL_MS, () =>
    fetchCampaignVideoThumbnailsUncached(id)
  )
}
