import "server-only"

import { buildTikTokCacheKey, getTikTokRequestContext } from "./tiktok-api.server"
import { withTikTokCache } from "./tiktok-cache"
import { normalizeTikTokMediaUrl } from "@/lib/services/sociavault/tiktok-media-hosts"
import type { TikTokApiResponse, TikTokPageInfo } from "./types"
import type { TikTokAdVideoAsset } from "./ad-video-asset"

export type { TikTokAdVideoAsset } from "./ad-video-asset"

const VIDEOS_TTL_MS = 2 * 60 * 1000
const PAGE_SIZE = 50
const MAX_PAGES = 20

interface TikTokVideoSearchRow {
  video_id?: string
  file_name?: string
  video_cover_url?: string
  poster_url?: string
  preview_url?: string
  video_url?: string
  playable_url?: string
  duration?: number
  width?: number
  height?: number
  format?: string
  create_time?: string
  displayable?: boolean
}

interface TikTokVideoSearchData {
  list?: TikTokVideoSearchRow[]
  page_info?: TikTokPageInfo
}

const VIDEO_FIELDS = JSON.stringify([
  "video_id",
  "file_name",
  "video_cover_url",
  "poster_url",
  "preview_url",
  "video_url",
  "duration",
  "width",
  "height",
  "format",
  "create_time",
  "displayable",
])

function mapVideoRow(row: TikTokVideoSearchRow): TikTokAdVideoAsset | null {
  const id = row.video_id?.trim()
  if (!id) return null

  const name = row.file_name?.trim() || `Video ${id.slice(-6)}`
  const rawCover =
    row.video_cover_url?.trim() || row.poster_url?.trim() || null
  const rawPreview =
    row.preview_url?.trim() ||
    row.video_url?.trim() ||
    row.playable_url?.trim() ||
    null

  return {
    id,
    name,
    profileName: null,
    itemId: null,
    identityId: null,
    identityType: null,
    coverUrl: rawCover ? normalizeTikTokMediaUrl(rawCover) : null,
    previewUrl: rawPreview ? normalizeTikTokMediaUrl(rawPreview) : null,
    durationMs:
      typeof row.duration === "number" && Number.isFinite(row.duration)
        ? row.duration
        : null,
    width: typeof row.width === "number" ? row.width : null,
    height: typeof row.height === "number" ? row.height : null,
    format: row.format?.trim() || null,
    createTime: row.create_time?.trim() || null,
  }
}

async function fetchTikTokAdVideos(): Promise<TikTokAdVideoAsset[]> {
  const { client, advertiserId } = await getTikTokRequestContext()
  const byId = new Map<string, TikTokAdVideoAsset>()
  let page = 1
  let totalPage = 1

  while (page <= totalPage && page <= MAX_PAGES) {
    const { data } = await client.get<TikTokApiResponse<TikTokVideoSearchData>>(
      "/file/video/ad/search/",
      {
        params: {
          advertiser_id: advertiserId,
          page,
          page_size: PAGE_SIZE,
          fields: VIDEO_FIELDS,
        },
      }
    )

    for (const row of data.data.list ?? []) {
      const mapped = mapVideoRow(row)
      if (!mapped) continue
      byId.set(mapped.id, mapped)
    }

    totalPage = data.data.page_info?.total_page ?? 1
    page += 1
  }

  return [...byId.values()].sort((a, b) => {
    const aTime = a.createTime ?? ""
    const bTime = b.createTime ?? ""
    if (aTime && bTime && aTime !== bTime) return bTime.localeCompare(aTime)
    return a.name.localeCompare(b.name, "es")
  })
}

export async function listTikTokAdVideos(): Promise<TikTokAdVideoAsset[]> {
  const cacheKey = await buildTikTokCacheKey("ad-videos")
  return withTikTokCache(cacheKey, VIDEOS_TTL_MS, fetchTikTokAdVideos)
}
