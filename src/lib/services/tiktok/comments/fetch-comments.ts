import "server-only"

import { getTikTokRequestContext } from "../tiktok-api.server"
import type { TikTokApiResponse, TikTokPageInfo } from "../types"
import { listTikTokCommentSearchUnits } from "./fetch-active-ads"
import { TIKTOK_COMMENT_WINDOW_HOURS } from "./constants"
import type {
  TikTokFetchedComment,
  TikTokLiveComment,
} from "./types"

type TikTokCommentRow = {
  comment_id?: string | number
  id?: string | number
  content?: string
  text?: string
  comment_content?: string
  create_time?: string | number
  user_name?: string
  username?: string
  nickname?: string
  display_name?: string
  comment_status?: string
  status?: string
  ad_id?: string | number
}

function formatTikTokDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function commentWindow(): { startTime: string; endTime: string } {
  const end = new Date()
  const start = new Date(
    Date.now() - TIKTOK_COMMENT_WINDOW_HOURS * 60 * 60 * 1000
  )
  return {
    startTime: formatTikTokDate(start),
    endTime: formatTikTokDate(end),
  }
}

function pickString(...values: Array<string | number | undefined | null>): string {
  for (const value of values) {
    if (value == null) continue
    const trimmed = String(value).trim()
    if (trimmed) return trimmed
  }
  return ""
}

function mapCommentRow(row: TikTokCommentRow): TikTokFetchedComment | null {
  const id = pickString(row.comment_id, row.id)
  const message = pickString(row.text, row.content, row.comment_content)
  if (!id || !message) return null

  const rawTime = row.create_time
  let createdTime = new Date().toISOString()
  if (typeof rawTime === "number") {
    createdTime = new Date(
      rawTime > 1e12 ? rawTime : rawTime * 1000
    ).toISOString()
  } else if (rawTime) {
    const parsed = Date.parse(String(rawTime).replace(" UTC", ""))
    createdTime = Number.isNaN(parsed)
      ? pickString(rawTime) || createdTime
      : new Date(parsed).toISOString()
  }

  return {
    id,
    message,
    createdTime,
    authorName:
      pickString(row.display_name, row.user_name, row.username, row.nickname) ||
      null,
    status: pickString(row.comment_status, row.status) || null,
    adId: pickString(row.ad_id) || null,
  }
}

/** Comentarios recientes de un adgroup (API solo acepta search_field=ADGROUP_ID). */
export async function fetchRecentAdgroupComments(
  adgroupId: string
): Promise<TikTokFetchedComment[]> {
  const { client, advertiserId } = await getTikTokRequestContext()
  const { startTime, endTime } = commentWindow()
  const items: TikTokFetchedComment[] = []
  let page = 1
  let totalPage = 1
  const maxPages = 10

  while (page <= totalPage && page <= maxPages) {
    const { data } = await client.get<
      TikTokApiResponse<{
        /** TikTok v1.3 usa `comments`; algunos SDKs documentan `list`. */
        comments?: TikTokCommentRow[]
        list?: TikTokCommentRow[]
        page_info?: TikTokPageInfo
      }>
    >("/comment/list/", {
      params: {
        advertiser_id: advertiserId,
        start_time: startTime,
        end_time: endTime,
        search_field: "ADGROUP_ID",
        search_value: adgroupId,
        ad_type: "BIDDING",
        sort_field: "CREATE_TIME",
        sort_type: "DESC",
        page,
        page_size: 50,
      },
    })

    const rows = data.data.comments ?? data.data.list ?? []
    for (const row of rows) {
      const mapped = mapCommentRow(row)
      if (mapped) items.push(mapped)
    }

    totalPage = data.data.page_info?.total_page ?? 1
    page += 1
  }

  return items
}

/** @deprecated Usar fetchRecentAdgroupComments — TikTok ya no acepta AD_ID. */
export async function fetchRecentAdComments(
  adId: string
): Promise<TikTokFetchedComment[]> {
  void adId
  throw new Error(
    "TikTok /comment/list/ solo acepta search_field=ADGROUP_ID. Usá fetchRecentAdgroupComments."
  )
}

/** Comentarios en vivo de adgroups Spark Urbanos/Elite (o todos si no hay). */
export async function fetchLiveTikTokAdComments(): Promise<{
  adsScanned: number
  sparkTargetAds: number
  adgroupsScanned: number
  comments: TikTokLiveComment[]
  fetchErrors: string[]
}> {
  const { units, adsScanned, sparkTargetAds } =
    await listTikTokCommentSearchUnits()
  const byId = new Map<string, TikTokLiveComment>()
  const fetchErrors: string[] = []

  for (const unit of units) {
    try {
      const rows = await fetchRecentAdgroupComments(unit.adgroupId)
      for (const row of rows) {
        if (byId.has(row.id)) continue
        byId.set(row.id, {
          ...row,
          adId: row.adId || unit.ad.adId,
          adName: unit.ad.adName,
          adgroupId: unit.adgroupId,
          profileName: unit.ad.profileName,
          tiktokItemId: unit.ad.tiktokItemId,
          processed: false,
        })
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error al leer comentarios"
      fetchErrors.push(
        `${unit.ad.profileName ?? unit.ad.adName} (${unit.adgroupId}): ${message}`
      )
    }
  }

  return {
    adsScanned,
    sparkTargetAds,
    adgroupsScanned: units.length,
    comments: [...byId.values()].sort((a, b) =>
      b.createdTime.localeCompare(a.createdTime)
    ),
    fetchErrors,
  }
}

export async function attachProcessedFlag(
  comments: TikTokLiveComment[]
): Promise<TikTokLiveComment[]> {
  if (comments.length === 0) return comments

  const prisma = (await import("@/lib/prisma")).default
  const ids = comments.map((c) => c.id)
  const processed = await prisma.tikTokCommentDecision.findMany({
    where: { tiktokCommentId: { in: ids } },
    select: { tiktokCommentId: true },
  })
  const processedSet = new Set(processed.map((row) => row.tiktokCommentId))

  return comments.map((comment) => ({
    ...comment,
    processed: processedSet.has(comment.id),
  }))
}
