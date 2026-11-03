import "server-only"

import { listTikTokAdAccounts } from "../ad-accounts"
import { mapWithConcurrency } from "../concurrency"
import { getTikTokRequestContext } from "../tiktok-api.server"
import { withTikTokDashboardAccount } from "../tiktok-dashboard-account.server"
import type { TikTokApiResponse, TikTokPageInfo } from "../types"
import {
  matchesTikTokCommentSparkProfile,
  TIKTOK_COMMENT_ACCOUNT_CONCURRENCY,
  TIKTOK_COMMENT_FETCH_CONCURRENCY,
  TIKTOK_COMMENT_WINDOW_HOURS,
  TIKTOK_LIVE_ADGROUP_CAP,
  TIKTOK_LIVE_COMMENTS_LIMIT,
  TIKTOK_LIVE_FETCH_BUDGET_MS,
  TIKTOK_LIVE_REQUEST_TIMEOUT_MS,
} from "./constants"
import type {
  TikTokActiveAdRef,
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

  if (typeof rawTime === "string" && /^\d+$/.test(rawTime.trim())) {
    return toIsoTime(Number(rawTime))
  }

  if (rawTime) {
    const normalized = String(rawTime)
      .trim()
      .replace(/\s*\+0000\s*UTC$/i, "Z")
      .replace(" UTC", "Z")
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
  adgroupId: string,
  options?: { maxPages?: number; timeoutMs?: number }
): Promise<TikTokFetchedComment[]> {
  const { client, advertiserId } = await getTikTokRequestContext()
  const { startTime, endTime } = commentWindow()
  const items: TikTokFetchedComment[] = []
  let page = 1
  let totalPage = 1
  const maxPages = options?.maxPages ?? 10

  while (page <= totalPage && page <= maxPages) {
    const { data } = await client.get<
      TikTokApiResponse<{
        /** TikTok v1.3 usa `comments`; algunos SDKs documentan `list`. */
        comments?: TikTokCommentRow[]
        list?: TikTokCommentRow[]
        page_info?: TikTokPageInfo
      }>
    >("/comment/list/", {
      timeout: options?.timeoutMs,
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

const LIVE_AD_FIELDS = JSON.stringify([
  "ad_id",
  "ad_name",
  "adgroup_id",
  "operation_status",
  "video_id",
  "tiktok_item_id",
  "identity_id",
  "identity_type",
  "display_name",
])

type LiveAdRow = {
  ad_id?: string
  ad_name?: string
  adgroup_id?: string
  operation_status?: string
  video_id?: string
  tiktok_item_id?: string
  identity_id?: string
  identity_type?: string
  display_name?: string
}

/** Conjuntos con impresiones en la ventana. No pagina el catálogo de 2 mil ads. */
async function topDeliveringAdgroupIds(limit: number): Promise<string[]> {
  const { client, advertiserId } = await getTikTokRequestContext()
  const { startTime, endTime } = commentWindow()
  const scored: Array<{ id: string; impressions: number }> = []
  let page = 1
  let totalPage = 1

  while (page <= totalPage && page <= 2) {
    const { data } = await client.get<
      TikTokApiResponse<{
        list?: Array<{
          dimensions?: { adgroup_id?: string }
          metrics?: { impressions?: string }
        }>
        page_info?: TikTokPageInfo
      }>
    >("/report/integrated/get/", {
      timeout: TIKTOK_LIVE_REQUEST_TIMEOUT_MS,
      params: {
        advertiser_id: advertiserId,
        service_type: "AUCTION",
        report_type: "BASIC",
        data_level: "AUCTION_ADGROUP",
        dimensions: JSON.stringify(["adgroup_id"]),
        metrics: JSON.stringify(["impressions"]),
        start_date: startTime,
        end_date: endTime,
        page,
        page_size: 500,
      },
    })

    for (const row of data.data?.list ?? []) {
      const id = row.dimensions?.adgroup_id?.trim() ?? ""
      const impressions = Number(row.metrics?.impressions ?? 0)
      if (!id || !Number.isFinite(impressions) || impressions <= 0) continue
      scored.push({ id, impressions })
    }

    totalPage = data.data?.page_info?.total_page ?? 1
    page += 1
  }

  scored.sort((a, b) => b.impressions - a.impressions)
  const ids: string[] = []
  const seen = new Set<string>()
  for (const row of scored) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    ids.push(row.id)
    if (ids.length >= limit) break
  }
  return ids
}

async function unitsForDeliveringAdgroups(
  adgroupIds: string[],
  account: { id: string | null; name: string | null }
): Promise<{ units: TikTokCommentSearchUnit[]; sparkTargetAds: number }> {
  if (adgroupIds.length === 0) return { units: [], sparkTargetAds: 0 }

  const { client, advertiserId } = await getTikTokRequestContext()
  const { data } = await client.get<
    TikTokApiResponse<{ list?: LiveAdRow[] }>
  >("/ad/get/", {
    timeout: TIKTOK_LIVE_REQUEST_TIMEOUT_MS,
    params: {
      advertiser_id: advertiserId,
      page: 1,
      page_size: 100,
      fields: LIVE_AD_FIELDS,
      filtering: JSON.stringify({ adgroup_ids: adgroupIds }),
    },
  })

  const byAdgroup = new Map<string, TikTokActiveAdRef>()
  for (const row of data.data?.list ?? []) {
    const adgroupId = row.adgroup_id?.trim()
    const adId = row.ad_id?.trim()
    if (!adgroupId || !adId || byAdgroup.has(adgroupId)) continue
    const profileName = row.display_name?.trim() || null
    byAdgroup.set(adgroupId, {
      adId,
      adName: row.ad_name?.trim() || adId,
      adgroupId,
      tiktokItemId: row.tiktok_item_id?.trim() || null,
      identityId: row.identity_id?.trim() || null,
      identityType: row.identity_type?.trim() || null,
      videoId: row.video_id?.trim() || null,
      profileName,
      isSparkTarget: matchesTikTokCommentSparkProfile(profileName),
      accountId: account.id,
      accountName: account.name,
    })
  }

  for (const adgroupId of adgroupIds) {
    if (byAdgroup.has(adgroupId)) continue
    byAdgroup.set(adgroupId, {
      adId: adgroupId,
      adName: adgroupId,
      adgroupId,
      tiktokItemId: null,
      identityId: null,
      identityType: null,
      videoId: null,
      profileName: null,
      isSparkTarget: false,
      accountId: account.id,
      accountName: account.name,
    })
  }

  const ads = [...byAdgroup.values()]

  return {
    sparkTargetAds: ads.filter((ad) => ad.isSparkTarget).length,
    units: ads.map((ad) => ({
      adgroupId: ad.adgroupId ?? ad.adId,
      ad,
    })),
  }
}

async function fetchCommentsWithinBudget(
  units: TikTokCommentSearchUnit[]
): Promise<{ comments: TikTokLiveComment[]; fetchErrors: string[] }> {
  const fetchErrors: string[] = []
  const byId = new Map<string, TikTokLiveComment>()
  const deadline = Date.now() + TIKTOK_LIVE_FETCH_BUDGET_MS
  let cursor = 0

  async function worker() {
    while (Date.now() < deadline && byId.size < TIKTOK_LIVE_COMMENTS_LIMIT) {
      const index = cursor
      cursor += 1
      const unit = units[index]
      if (!unit) return

      try {
        const rows = await fetchRecentAdgroupComments(unit.adgroupId, {
          maxPages: 1,
          timeoutMs: TIKTOK_LIVE_REQUEST_TIMEOUT_MS,
        })
        for (const row of rows) {
          if (byId.has(row.id)) continue
          byId.set(row.id, {
            ...row,
            adId: row.adId || unit.ad.adId,
            adName: unit.ad.adName,
            adgroupId: unit.adgroupId,
            profileName: unit.ad.profileName,
            tiktokItemId: unit.ad.tiktokItemId,
            accountName: unit.ad.accountName,
            processed: false,
          })
          if (byId.size >= TIKTOK_LIVE_COMMENTS_LIMIT) break
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Error al leer comentarios"
        fetchErrors.push(
          `${unit.ad.profileName ?? unit.ad.adName} (${unit.adgroupId}): ${message}`
        )
      }
    }
  }

  const workers = Math.min(TIKTOK_COMMENT_FETCH_CONCURRENCY, units.length)
  if (workers > 0) {
    await Promise.all(Array.from({ length: workers }, () => worker()))
  }

  return { comments: [...byId.values()], fetchErrors }
}

async function fetchLiveCommentsForCurrentAccount(account: {
  id: string | null
  name: string | null
}): Promise<{
  adsScanned: number
  sparkTargetAds: number
  adgroupsScanned: number
  comments: TikTokLiveComment[]
  fetchErrors: string[]
}> {
  const adgroupIds = await topDeliveringAdgroupIds(TIKTOK_LIVE_ADGROUP_CAP)
  const { units, sparkTargetAds } = await unitsForDeliveringAdgroups(
    adgroupIds,
    account
  )
  const fetched = await fetchCommentsWithinBudget(units)
  return {
    adsScanned: units.length,
    sparkTargetAds,
    adgroupsScanned: units.length,
    comments: fetched.comments,
    fetchErrors: fetched.fetchErrors,
  }
}

/** Comentarios en vivo de conjuntos con vistas recientes. Claude no interviene. */
export async function fetchLiveTikTokAdComments(): Promise<{
  adsScanned: number
  sparkTargetAds: number
  adgroupsScanned: number
  comments: TikTokLiveComment[]
  fetchErrors: string[]
}> {
  const accounts = await listTikTokAdAccounts().catch(() => [])
  const targets: Array<{ id: string | null; name: string | null }> =
    accounts.length > 0
      ? accounts.map((account) => ({ id: account.id, name: account.name }))
      : [{ id: null, name: null }]

  const parts = await mapWithConcurrency(
    targets,
    TIKTOK_COMMENT_ACCOUNT_CONCURRENCY,
    async (account) => {
      try {
        const run = () => fetchLiveCommentsForCurrentAccount(account)
        if (!account.id) return run()
        return withTikTokDashboardAccount(account.id, run)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Error al leer comentarios"
        return {
          adsScanned: 0,
          sparkTargetAds: 0,
          adgroupsScanned: 0,
          comments: [] as TikTokLiveComment[],
          fetchErrors: [`${account.name ?? "TikTok"}: ${message}`],
        }
      }
    }
  )

  const byId = new Map<string, TikTokLiveComment>()
  const fetchErrors: string[] = []
  let adsScanned = 0
  let sparkTargetAds = 0
  let adgroupsScanned = 0

  for (const part of parts) {
    adsScanned += part.adsScanned
    sparkTargetAds += part.sparkTargetAds
    adgroupsScanned += part.adgroupsScanned
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
    adgroupsScanned,
    comments,
    fetchErrors,
  }
}

export async function attachProcessedFlag(
  comments: TikTokLiveComment[]
): Promise<TikTokLiveComment[]> {
  if (comments.length === 0) return comments

  try {
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
  } catch (error) {
    console.warn("[tiktok-comments] No se pudo marcar procesados:", error)
    return comments
  }
}
