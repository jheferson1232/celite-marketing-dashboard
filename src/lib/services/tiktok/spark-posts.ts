import "server-only"

import { normalizeTikTokMediaUrl } from "@/lib/services/sociavault/tiktok-media-hosts"
import {
  buildTikTokCacheKey,
  getTikTokRequestContext,
} from "./tiktok-api.server"
import { withTikTokCache } from "./tiktok-cache"
import type { TikTokApiResponse, TikTokPageInfo } from "./types"
import {
  toSparkVideoSelectionId,
  type TikTokAdVideoAsset,
} from "./ad-video-asset"

const SPARK_POSTS_TTL_MS = 2 * 60 * 1000
const PAGE_SIZE = 50
const MAX_PAGES = 40

type SparkListRow = {
  item_info?: {
    item_id?: string | number
    item_type?: string
  }
  user_info?: {
    tiktok_name?: string
    identity_id?: string
    identity_type?: string
  }
  auth_info?: {
    auth_start_time?: string
    invite_start_time?: string
  }
  video_info?: {
    poster_url?: string
    video_cover_url?: string
    preview_url?: string
    url?: string
    duration?: number
    width?: number
    height?: number
  }
}

function mapSparkRow(row: SparkListRow): TikTokAdVideoAsset | null {
  const itemId =
    row.item_info?.item_id != null ? String(row.item_info.item_id).trim() : ""
  if (!itemId) return null
  if (row.item_info?.item_type && row.item_info.item_type !== "VIDEO") {
    return null
  }

  const profileName = row.user_info?.tiktok_name?.trim() || null
  const rawCover =
    row.video_info?.poster_url?.trim() ||
    row.video_info?.video_cover_url?.trim() ||
    null
  const rawPreview =
    row.video_info?.preview_url?.trim() || row.video_info?.url?.trim() || null
  const createTime =
    row.auth_info?.auth_start_time?.trim() ||
    row.auth_info?.invite_start_time?.trim() ||
    null

  const durationSec =
    typeof row.video_info?.duration === "number" &&
    Number.isFinite(row.video_info.duration)
      ? row.video_info.duration
      : null

  return {
    id: toSparkVideoSelectionId(itemId),
    name: profileName || `Post ${itemId.slice(-6)}`,
    profileName,
    itemId,
    identityId: row.user_info?.identity_id?.trim() || null,
    identityType: row.user_info?.identity_type?.trim() || null,
    coverUrl: rawCover ? normalizeTikTokMediaUrl(rawCover) : null,
    previewUrl: rawPreview ? normalizeTikTokMediaUrl(rawPreview) : null,
    durationMs: durationSec != null ? Math.round(durationSec * 1000) : null,
    width: typeof row.video_info?.width === "number" ? row.video_info.width : null,
    height:
      typeof row.video_info?.height === "number" ? row.video_info.height : null,
    format: null,
    createTime,
  }
}

async function fetchTikTokSparkPosts(): Promise<TikTokAdVideoAsset[]> {
  const { client, advertiserId } = await getTikTokRequestContext()
  const byId = new Map<string, TikTokAdVideoAsset>()
  let page = 1
  let totalPage = 1

  while (page <= totalPage && page <= MAX_PAGES) {
    const { data } = await client.get<
      TikTokApiResponse<{ list?: SparkListRow[]; page_info?: TikTokPageInfo }>
    >("/tt_video/list/", {
      params: {
        advertiser_id: advertiserId,
        page,
        page_size: PAGE_SIZE,
      },
    })

    for (const row of data.data.list ?? []) {
      const mapped = mapSparkRow(row)
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
    return (a.profileName ?? a.name).localeCompare(b.profileName ?? b.name, "es")
  })
}

/** Posts orgánicos autorizados (Spark) — originales con nombre de perfil. */
export async function listTikTokSparkPosts(): Promise<TikTokAdVideoAsset[]> {
  const cacheKey = await buildTikTokCacheKey("spark-posts:v2")
  return withTikTokCache(cacheKey, SPARK_POSTS_TTL_MS, fetchTikTokSparkPosts)
}

export async function getTikTokSparkPostByItemId(
  itemId: string
): Promise<TikTokAdVideoAsset | null> {
  const trimmed = itemId.trim()
  if (!trimmed) return null

  const posts = await listTikTokSparkPosts()
  return (
    posts.find((post) => post.id === toSparkVideoSelectionId(trimmed)) ?? null
  )
}

export async function getTikTokSparkPostPreviewUrl(
  itemId: string
): Promise<string | null> {
  const post = await getTikTokSparkPostByItemId(itemId)
  return post?.previewUrl ?? null
}
