import { normalizeTikTokMediaUrl } from "@/lib/services/sociavault/tiktok-media-hosts"
import { fetchAllPages } from "./fetch-all-pages"
import { listTikTokSparkPosts } from "./spark-posts"
import {
  buildTikTokCacheKey,
  getTikTokRequestContext,
} from "./tiktok-api.server"
import { withTikTokAccountForCampaign } from "./resolve-campaign-account"
import { withTikTokCache } from "./tiktok-cache"
import { withTikTokDashboardAccount } from "./tiktok-dashboard-account.server"
import type {
  TikTokAd,
  TikTokAdVideo,
  TikTokApiResponse,
} from "./types"

const THUMBNAILS_TTL_MS = 5 * 60 * 1000

const AD_FIELDS = JSON.stringify([
  "ad_id",
  "ad_name",
  "video_id",
  "image_ids",
  "tiktok_item_id",
  "ad_format",
  "identity_id",
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

async function fetchSparkCovers(
  itemIds: string[]
): Promise<Map<string, string>> {
  if (itemIds.length === 0) return new Map()

  const wanted = new Set(itemIds.map((id) => String(id)))
  const posts = await listTikTokSparkPosts().catch((error) => {
    console.error("Error fetching TikTok Spark covers:", error)
    return []
  })

  const map = new Map<string, string>()
  for (const post of posts) {
    const itemId = post.itemId?.trim()
    if (!itemId || !wanted.has(itemId) || map.has(itemId)) continue
    const cover = post.coverUrl?.trim()
    if (!cover) continue
    map.set(itemId, cover)
  }
  return map
}

function pickAdThumbnail(
  ad: TikTokAd,
  videoCovers: Map<string, string>,
  sparkCovers: Map<string, string>,
  imageUrls: Map<string, string>
): { id: string; thumbnailUrl: string } | null {
  const sparkItemId = ad.tiktok_item_id ? String(ad.tiktok_item_id) : ""
  const libraryCover = ad.video_id ? (videoCovers.get(ad.video_id) ?? "") : ""
  const sparkCover = sparkItemId ? (sparkCovers.get(sparkItemId) ?? "") : ""
  const imageCover =
    ad.image_ids?.map((imageId) => imageUrls.get(imageId)).find(Boolean) ?? ""
  const thumbnailUrl = libraryCover || sparkCover || imageCover
  if (!thumbnailUrl) return null

  const id =
    (ad.video_id && libraryCover ? ad.video_id : "") ||
    (sparkItemId ? `spark:${sparkItemId}` : "") ||
    `ad:${ad.ad_id}`

  return { id, thumbnailUrl }
}

async function fetchCampaignVideoThumbnailsUncached(
  campaignId: string
): Promise<TikTokCampaignVideoThumbnail[]> {
  const ads = await fetchAllPages<TikTokAd>("/ad/get/", {
    fields: AD_FIELDS,
    filtering: JSON.stringify({
      campaign_ids: [campaignId],
      primary_status: "STATUS_ALL",
    }),
  })

  const videoIds = [
    ...new Set(ads.map((ad) => ad.video_id).filter((id): id is string => !!id)),
  ]
  const sparkItemIds = [
    ...new Set(
      ads
        .map((ad) => ad.tiktok_item_id)
        .filter((id): id is string => Boolean(id))
        .map((id) => String(id))
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
    const picked = pickAdThumbnail(ad, videoCovers, sparkCovers, imageUrls)
    if (!picked || byKey.has(picked.id)) continue
    byKey.set(picked.id, {
      id: picked.id,
      name: ad.ad_name?.trim() || `Anuncio ${ad.ad_id}`,
      thumbnailUrl: picked.thumbnailUrl,
    })
  }

  return [...byKey.values()]
}

/** Miniaturas (solo imágenes cover) de creativos de una campaña TikTok. */
export async function getTikTokCampaignVideoThumbnails(
  campaignId: string,
  accountId?: string
): Promise<TikTokCampaignVideoThumbnail[]> {
  const id = campaignId.trim()
  if (!id) return []

  const run = async () => {
    const cacheKey = await buildTikTokCacheKey(
      `campaign-video-thumbs:v2:${id}`
    )
    return withTikTokCache(cacheKey, THUMBNAILS_TTL_MS, () =>
      fetchCampaignVideoThumbnailsUncached(id)
    )
  }

  if (accountId?.trim()) {
    return withTikTokDashboardAccount(accountId, run)
  }

  return withTikTokAccountForCampaign(id, run)
}
