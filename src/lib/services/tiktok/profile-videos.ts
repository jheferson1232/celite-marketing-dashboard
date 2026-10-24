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
  type TikTokProfileVideoAccount,
} from "./ad-video-asset"

/** Cuentas orgánicas autorizadas para anuncios en el formulario de campaña. */
const PROFILE_USERNAMES = ["mokado.co", "mokadomkd"] as const

export type TikTokProfileVideoCatalog = {
  accounts: TikTokProfileVideoAccount[]
}
const VIDEOS_TTL_MS = 2 * 60 * 1000
const IDENTITY_PAGE_SIZE = 100
const VIDEO_PAGE_SIZE = 20
const MAX_IDENTITY_PAGES = 5
const MAX_VIDEO_PAGES = 40

type TikTokIdentityRow = {
  identity_id?: string
  identity_type?: string
  identity_authorized_bc_id?: string | null
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
  is_ai_generated?: boolean
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
  identityAuthorizedBcId: string | null
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
    caption,
    aiGenerated: row.is_ai_generated === true,
    profileName: identity.username,
    itemId,
    identityId: identity.identityId,
    identityType: identity.identityType,
    identityAuthorizedBcId: identity.identityAuthorizedBcId,
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

function profileAccountLabel(): string {
  return PROFILE_USERNAMES.map((username) => `@${username}`).join(" y ")
}

function identityRank(identityType: string): number {
  if (identityType === "TT_USER") return 0
  if (identityType === "BC_AUTH_TT") return 1
  return 2
}

async function findCampaignProfileIdentities(): Promise<
  Map<string, ProfileIdentity>
> {
  const { client, advertiserId } = await getTikTokRequestContext()
  const wanted = new Set<string>(PROFILE_USERNAMES)
  const found = new Map<string, ProfileIdentity>()
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

    for (const row of data.data.identity_list ?? []) {
      const username = row.username?.trim().toLowerCase() ?? ""
      if (!wanted.has(username)) continue
      const identityType = row.identity_type?.trim() ?? ""
      if (identityType !== "TT_USER" && identityType !== "BC_AUTH_TT") continue
      if (row.can_pull_video === false) continue
      const identityId = row.identity_id?.trim()
      if (!identityId) continue
      const identityAuthorizedBcId =
        identityType === "BC_AUTH_TT"
          ? row.identity_authorized_bc_id?.trim() || null
          : null
      if (identityType === "BC_AUTH_TT" && !identityAuthorizedBcId) continue

      const current = found.get(username)
      if (current && identityRank(current.identityType) <= identityRank(identityType)) {
        continue
      }

      found.set(username, {
        identityId,
        identityType,
        identityAuthorizedBcId,
        username,
        displayName: row.display_name?.trim() || username,
      })
    }

    const hasPreferredIdentity = PROFILE_USERNAMES.every(
      (username) => found.get(username)?.identityType === "TT_USER"
    )
    if (hasPreferredIdentity) break

    totalPage = data.data.page_info?.total_page ?? 1
    page += 1
  }

  return found
}

async function fetchIdentityVideos(
  identity: ProfileIdentity
): Promise<TikTokAdVideoAsset[]> {
  const { client, advertiserId } = await getTikTokRequestContext()
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
        ...(identity.identityAuthorizedBcId
          ? { identity_authorized_bc_id: identity.identityAuthorizedBcId }
          : {}),
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

const BULK_CAPTION_REPEAT = 3
const GENERATED_CAPTION =
  /env[ií]o gratis|contraentrega|entrega r[aá]pida|entrega segura|sin costos ocultos|tenis c[oó]modos y duraderos|asegura tu pedido/i

function captionKey(caption: string): string {
  return caption.replace(/\s+/g, " ").trim().toLocaleLowerCase("es")
}

function looksLikePublishedPost(caption: string): boolean {
  if (caption.includes("#")) return true
  if (/https?:\/\//i.test(caption)) return true
  return /\d{10,}/.test(caption.replace(/[\s().+-]/g, ""))
}

/** Oculta copias en lote (mismo pie genérico) y plantillas de envío que no son posts de la cuenta. */
export function publishedTikTokProfileVideos(
  videos: TikTokAdVideoAsset[]
): TikTokAdVideoAsset[] {
  const counts = new Map<string, number>()
  for (const video of videos) {
    const caption = video.caption?.trim()
    if (!caption) continue
    const key = captionKey(caption)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return videos.filter((video) => {
    if (video.aiGenerated) return false
    const caption = video.caption?.trim() ?? ""
    if (!caption || looksLikePublishedPost(caption)) return true
    if ((counts.get(captionKey(caption)) ?? 0) >= BULK_CAPTION_REPEAT) return false
    return !GENERATED_CAPTION.test(caption)
  })
}

function accountLoadError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  return "No se pudieron cargar los videos de esta cuenta."
}

async function fetchProfileVideoCatalog(): Promise<TikTokProfileVideoCatalog> {
  const identities = await findCampaignProfileIdentities()
  if (identities.size === 0) {
    throw new Error(
      `Ninguna de las cuentas ${profileAccountLabel()} está vinculada para anuncios en esta cuenta de TikTok Ads.`
    )
  }

  const loaded = await Promise.all(
    PROFILE_USERNAMES.map(async (username) => {
      const identity = identities.get(username)
      if (!identity) {
        return {
          username,
          displayName: username,
          linked: false,
          error: null,
          videos: [],
        } satisfies TikTokProfileVideoAccount
      }

      try {
        const videos = await fetchIdentityVideos(identity)
        return {
          username,
          displayName: identity.displayName,
          linked: true,
          error: null,
          videos,
        } satisfies TikTokProfileVideoAccount
      } catch (error) {
        return {
          username,
          displayName: identity.displayName,
          linked: true,
          error: accountLoadError(error),
          videos: [],
        } satisfies TikTokProfileVideoAccount
      }
    })
  )

  return { accounts: loaded }
}

/** Videos de @mokado.co y @mokadomkd, disponibles para anuncios. */
export async function listTikTokProfileVideoCatalog(): Promise<TikTokProfileVideoCatalog> {
  const cacheKey = await buildTikTokCacheKey(
    `profile-videos:${PROFILE_USERNAMES.join("+")}:v4`
  )
  return withTikTokCache(cacheKey, VIDEOS_TTL_MS, fetchProfileVideoCatalog)
}

/** Videos publicados en las cuentas orgánicas vinculadas. */
export async function listTikTokProfileVideos(): Promise<TikTokAdVideoAsset[]> {
  const catalog = await listTikTokProfileVideoCatalog()
  return catalog.accounts.flatMap((account) => account.videos)
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
