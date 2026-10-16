import "server-only"

import { normalizeTikTokMediaUrl } from "@/lib/services/sociavault/tiktok-media-hosts"
import {
  buildTikTokCacheKey,
  getTikTokRequestContext,
} from "./tiktok-api.server"
import { withTikTokCache } from "./tiktok-cache"
import type { TikTokApiResponse, TikTokPageInfo } from "./types"
import {
  compareTikTokVideosByDateDesc,
  toSparkVideoSelectionId,
  type TikTokAdVideoAsset,
} from "./ad-video-asset"

/** Cuenta orgánica autorizada para anuncios en el formulario de campaña. */
const PROFILE_USERNAME = "mokado.co"
const VIDEOS_TTL_MS = 2 * 60 * 1000
const IDENTITY_PAGE_SIZE = 100
const VIDEO_PAGE_SIZE = 20
const MAX_IDENTITY_PAGES = 5
const MAX_VIDEO_PAGES = 40

type TikTokIdentityRow = {
  identity_id?: string
  identity_type?: string
  username?: string | null
  display_name?: string | null
  can_pull_video?: boolean | null
  available_status?: string | null
}

type IdentityVideoRow = {
  item_id?: string | number
  item_type?: string
  status?: string
  text?: string
  video_info?: {
    poster_url?: string
    url?: string
    duration?: number
    width?: number
    height?: number
    format?: string
  }
}

type ProfileIdentity = {
  identityId: string
  identityType: string
  username: string
  displayName: string
}

function tikTokItemCreateTime(itemId: string): string | null {
  try {
    const seconds = Number(BigInt(itemId) >> BigInt(32))
    if (!Number.isFinite(seconds) || seconds < 1_000_000_000) return null
    return String(seconds)
  } catch {
    return null
  }
}

function isUsableProfileVideo(status: string | undefined): boolean {
  const value = (status ?? "").toUpperCase()
  if (!value) return true
  if (value.includes("DELETE")) return false
  if (value.includes("PRIVATE")) return false
  if (value.includes("ONLY_AUTHOR")) return false
  return true
}

function mapProfileVideo(
  row: IdentityVideoRow,
  identity: ProfileIdentity
): TikTokAdVideoAsset | null {
  const itemId = row.item_id != null ? String(row.item_id).trim() : ""
  if (!itemId) return null
  if (row.item_type && row.item_type !== "VIDEO") return null
  if (!isUsableProfileVideo(row.status)) return null

  const caption = row.text?.trim() || null
  const rawCover = row.video_info?.poster_url?.trim() || null
  const rawPreview = row.video_info?.url?.trim() || null
  const durationSec =
    typeof row.video_info?.duration === "number" &&
    Number.isFinite(row.video_info.duration)
      ? row.video_info.duration
      : null

  return {
    id: toSparkVideoSelectionId(itemId),
    name: caption || `@${identity.username}`,
    profileName: identity.username,
    itemId,
    identityId: identity.identityId,
    identityType: identity.identityType,
    coverUrl: rawCover ? normalizeTikTokMediaUrl(rawCover) : null,
    previewUrl: rawPreview ? normalizeTikTokMediaUrl(rawPreview) : null,
    durationMs: durationSec != null ? Math.round(durationSec * 1000) : null,
    width: typeof row.video_info?.width === "number" ? row.video_info.width : null,
    height:
      typeof row.video_info?.height === "number" ? row.video_info.height : null,
    format: row.video_info?.format?.trim() || null,
    createTime: tikTokItemCreateTime(itemId),
  }
}

async function findProfileIdentity(): Promise<ProfileIdentity> {
  const { client, advertiserId } = await getTikTokRequestContext()
  let page = 1
  let totalPage = 1

  while (page <= totalPage && page <= MAX_IDENTITY_PAGES) {
    const { data } = await client.get<
      TikTokApiResponse<{
        identity_list?: TikTokIdentityRow[]
        page_info?: TikTokPageInfo
      }>
    >("/identity/get/", {
      params: {
        advertiser_id: advertiserId,
        page,
        page_size: IDENTITY_PAGE_SIZE,
      },
    })

    const match = (data.data.identity_list ?? []).find((row) => {
      const username = row.username?.trim().toLowerCase()
      return (
        username === PROFILE_USERNAME &&
        row.identity_type === "TT_USER" &&
        row.can_pull_video !== false &&
        Boolean(row.identity_id?.trim())
      )
    })

    if (match?.identity_id) {
      return {
        identityId: match.identity_id.trim(),
        identityType: "TT_USER",
        username: PROFILE_USERNAME,
        displayName: match.display_name?.trim() || PROFILE_USERNAME,
      }
    }

    totalPage = data.data.page_info?.total_page ?? 1
    page += 1
  }

  throw new Error(
    `La cuenta @${PROFILE_USERNAME} no está vinculada para anuncios en esta cuenta de TikTok Ads.`
  )
}

async function fetchProfileVideos(): Promise<TikTokAdVideoAsset[]> {
  const { client, advertiserId } = await getTikTokRequestContext()
  const identity = await findProfileIdentity()
  const byId = new Map<string, TikTokAdVideoAsset>()
  let cursor = ""
  let page = 0

  while (page < MAX_VIDEO_PAGES) {
    const { data } = await client.get<
      TikTokApiResponse<{
        video_list?: IdentityVideoRow[]
        cursor?: string
        has_more?: boolean
      }>
    >("/identity/video/get/", {
      params: {
        advertiser_id: advertiserId,
        identity_id: identity.identityId,
        identity_type: identity.identityType,
        count: VIDEO_PAGE_SIZE,
        ...(cursor ? { cursor } : {}),
      },
    })

    for (const row of data.data.video_list ?? []) {
      const mapped = mapProfileVideo(row, identity)
      if (!mapped) continue
      byId.set(mapped.id, mapped)
    }

    const nextCursor = data.data.cursor?.trim() ?? ""
    if (!data.data.has_more || !nextCursor || nextCursor === cursor) break
    cursor = nextCursor
    page += 1
  }

  return [...byId.values()].sort(compareTikTokVideosByDateDesc)
}

/** Videos publicados en @mokado.co, disponibles para anuncios. */
export async function listTikTokProfileVideos(): Promise<TikTokAdVideoAsset[]> {
  const cacheKey = await buildTikTokCacheKey(
    `profile-videos:${PROFILE_USERNAME}:v1`
  )
  return withTikTokCache(cacheKey, VIDEOS_TTL_MS, fetchProfileVideos)
}

export async function getTikTokProfileVideoByItemId(
  itemId: string
): Promise<TikTokAdVideoAsset | null> {
  const trimmed = itemId.trim()
  if (!trimmed) return null
  const videos = await listTikTokProfileVideos()
  return (
    videos.find((video) => video.itemId === trimmed || video.id === trimmed) ??
    null
  )
}
