import "server-only"

import { mapWithConcurrency } from "../concurrency"
import { getTikTokRequestContext } from "../tiktok-api.server"
import { withTikTokDashboardAccount } from "../tiktok-dashboard-account.server"
import type { TikTokApiResponse, TikTokPageInfo } from "../types"
import {
  TIKTOK_COMMENT_FETCH_CONCURRENCY,
  TIKTOK_COMMENT_WINDOW_HOURS,
  TIKTOK_LIVE_COMMENTS_LIMIT,
} from "./constants"
import { listTikTokCommentSearchUnitsAllAccounts } from "./fetch-active-ads"
import type {
  TikTokCommentSearchUnit,
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

function toIsoTime(rawTime: string | number | undefined): string {
  if (typeof rawTime === "number" && Number.isFinite(rawTime)) {
    const ms = rawTime > 1e12 ? rawTime : rawTime * 1000
    const date = new Date(ms)
    if (!Number.isNaN(date.getTime())) return date.toISOString()
  }

  if (rawTime) {
    const normalized = String(rawTime)
      .trim()
      .replace(" UTC", "")
      .replace(" ", "T")
    const parsed = Date.parse(normalized)
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString()
  }

  return new Date().toISOString()
}

function mapCommentRow(row: TikTokCommentRow): TikTokFetchedComment | null {
  const id = pickString(row.comment_id, row.id)
  const message = pickString(row.content, row.text, row.comment_content)
  if (!id || !message) return null

  return {
    id,
    message,
    createdTime: toIsoTime(row.create_time),
    authorName:
      pickString(row.user_name, row.username, row.display_name, row.nickname) ||
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

    const payload = data.data
    const rows = payload?.comments ?? payload?.list ?? []
    for (const row of rows) {
      const mapped = mapCommentRow(row)
      if (mapped) items.push(mapped)
    }

    totalPage = payload?.page_info?.total_page ?? 1
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

function groupUnitsByAccount(units: TikTokCommentSearchUnit[]) {
  const groups = new Map<string, TikTokCommentSearchUnit[]>()
  for (const unit of units) {
    const key = unit.ad.accountId ?? "__current__"
    const list = groups.get(key)
    if (list) list.push(unit)
    else groups.set(key, [unit])
  }
  return [...groups.entries()]
}

async function fetchCommentsForUnits(units: TikTokCommentSearchUnit[]): Promise<{
  comments: TikTokLiveComment[]
  fetchErrors: string[]
}> {
  const fetchErrors: string[] = []
  const byId = new Map<string, TikTokLiveComment>()

  const results = await mapWithConcurrency(
    units,
    TIKTOK_COMMENT_FETCH_CONCURRENCY,
    async (unit) => {
      try {
        const rows = await fetchRecentAdgroupComments(unit.adgroupId)
        return { unit, rows, error: null as string | null }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Error al leer comentarios"
        return {
          unit,
          rows: [] as TikTokFetchedComment[],
          error: `${unit.ad.profileName ?? unit.ad.adName} (${unit.adgroupId}): ${message}`,
        }
      }
    }
  )

  for (const result of results) {
    if (result.error) {
      fetchErrors.push(result.error)
      continue
    }
    for (const row of result.rows) {
      if (byId.has(row.id)) continue
      byId.set(row.id, {
        ...row,
        adId: row.adId || result.unit.ad.adId,
        adName: result.unit.ad.adName,
        adgroupId: result.unit.adgroupId,
        profileName: result.unit.ad.profileName,
        tiktokItemId: result.unit.ad.tiktokItemId,
        accountName: result.unit.ad.accountName,
        processed: false,
      })
    }
  }

  return { comments: [...byId.values()], fetchErrors }
}

/** Comentarios en vivo de adgroups Spark Urbanos/Elite (todas las cuentas). */
export async function fetchLiveTikTokAdComments(): Promise<{
  adsScanned: number
  sparkTargetAds: number
  adgroupsScanned: number
  comments: TikTokLiveComment[]
  fetchErrors: string[]
}> {
  const { units, adsScanned, sparkTargetAds } =
    await listTikTokCommentSearchUnitsAllAccounts()

  const grouped = groupUnitsByAccount(units)
  const parts = await mapWithConcurrency(
    grouped,
    TIKTOK_COMMENT_FETCH_CONCURRENCY > 2 ? 2 : 1,
    async ([accountId, accountUnits]) => {
      const run = () => fetchCommentsForUnits(accountUnits)
      if (accountId === "__current__") return run()
      return withTikTokDashboardAccount(accountId, run)
    }
  )

  const byId = new Map<string, TikTokLiveComment>()
  const fetchErrors: string[] = []
  for (const part of parts) {
    fetchErrors.push(...part.fetchErrors)
    for (const comment of part.comments) {
      if (!byId.has(comment.id)) byId.set(comment.id, comment)
    }
  }

  const comments = [...byId.values()]
    .sort((a, b) => b.createdTime.localeCompare(a.createdTime))
    .slice(0, TIKTOK_LIVE_COMMENTS_LIMIT)

  return {
    adsScanned,
    sparkTargetAds,
    adgroupsScanned: units.length,
    comments,
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
