import "server-only"

import { buildTikTokCacheKey, getTikTokRequestContext } from "./tiktok-api.server"
import { withTikTokCache } from "./tiktok-cache"
import type { TikTokAdVideo, TikTokApiResponse } from "./types"

const VIDEO_SOURCE_TTL_MS = 10 * 60 * 1000

function pickPlayableUrl(video: TikTokAdVideo | undefined): string | null {
  if (!video) return null
  return (
    video.preview_url?.trim() ||
    video.video_url?.trim() ||
    video.playable_url?.trim() ||
    null
  )
}

async function fetchTikTokCreativeVideoSource(
  videoId: string
): Promise<string | null> {
  const { client, advertiserId } = await getTikTokRequestContext()

  const { data } = await client.get<TikTokApiResponse<{ list: TikTokAdVideo[] }>>(
    "/file/video/ad/info/",
    {
      params: {
        advertiser_id: advertiserId,
        video_ids: JSON.stringify([videoId]),
      },
    }
  )

  return pickPlayableUrl(data.data.list?.[0])
}

export async function getTikTokCreativeVideoSource(
  videoId: string
): Promise<string | null> {
  const trimmed = videoId.trim()
  if (!trimmed) return null

  const cacheKey = await buildTikTokCacheKey(`video-source:${trimmed}`)
  return withTikTokCache(cacheKey, VIDEO_SOURCE_TTL_MS, () =>
    fetchTikTokCreativeVideoSource(trimmed)
  )
}
