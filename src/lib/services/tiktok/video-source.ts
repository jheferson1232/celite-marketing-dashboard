import "server-only"

import { normalizeTikTokMediaUrl } from "@/lib/services/sociavault/tiktok-media-hosts"
import {
  buildTikTokCacheKey,
  getTikTokRequestContext,
} from "./tiktok-api.server"
import { withTikTokCache } from "./tiktok-cache"
import type { TikTokAdVideo, TikTokApiResponse, TikTokPageInfo } from "./types"

const VIDEO_SOURCE_TTL_MS = 10 * 60 * 1000

function pickPlayableUrl(video: TikTokAdVideo | undefined): string | null {
  if (!video) return null
  const raw =
    video.preview_url?.trim() ||
    video.video_url?.trim() ||
    video.playable_url?.trim() ||
    null
  return raw ? normalizeTikTokMediaUrl(raw) : null
}

async function fetchLibraryVideoSource(
  videoId: string
): Promise<string | null> {
  const { client, advertiserId } = await getTikTokRequestContext()

  const { data } = await client.get<
    TikTokApiResponse<{ list: TikTokAdVideo[] }>
  >("/file/video/ad/info/", {
    params: {
      advertiser_id: advertiserId,
      video_ids: JSON.stringify([videoId]),
      fields: JSON.stringify([
        "video_id",
        "preview_url",
        "video_url",
        "playable_url",
      ]),
    },
  })

  return pickPlayableUrl(data.data.list?.[0])
}

async function fetchSparkItemVideoSource(
  itemId: string
): Promise<string | null> {
  const { client, advertiserId } = await getTikTokRequestContext()
  let page = 1
  let totalPage = 1

  while (page <= totalPage && page <= 20) {
    const { data } = await client.get<
      TikTokApiResponse<{
        list?: Array<{
          item_info?: { item_id?: string | number }
          video_info?: { preview_url?: string; url?: string }
        }>
        page_info?: TikTokPageInfo
      }>
    >("/tt_video/list/", {
      params: {
        advertiser_id: advertiserId,
        filtering: JSON.stringify({ item_ids: [itemId] }),
        page,
        page_size: 50,
      },
    })

    for (const row of data.data.list ?? []) {
      if (String(row.item_info?.item_id ?? "") !== itemId) continue
      const raw =
        row.video_info?.preview_url?.trim() ||
        row.video_info?.url?.trim() ||
        null
      return raw ? normalizeTikTokMediaUrl(raw) : null
    }

    totalPage = data.data.page_info?.total_page ?? 1
    page += 1
  }

  return null
}

async function fetchTikTokCreativeVideoSource(
  videoId: string
): Promise<string | null> {
  if (videoId.startsWith("spark:")) {
    return fetchSparkItemVideoSource(videoId.slice("spark:".length))
  }
  return fetchLibraryVideoSource(videoId)
}

export async function getTikTokCreativeVideoSource(
  videoId: string
): Promise<string | null> {
  const trimmed = videoId.trim()
  if (!trimmed) return null

  const cacheKey = await buildTikTokCacheKey(`video-source:v2:${trimmed}`)
  return withTikTokCache(cacheKey, VIDEO_SOURCE_TTL_MS, () =>
    fetchTikTokCreativeVideoSource(trimmed)
  )
}
