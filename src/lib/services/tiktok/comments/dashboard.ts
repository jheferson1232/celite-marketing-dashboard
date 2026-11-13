import "server-only"

import prisma from "@/lib/prisma"
import { addDaysToDateString, getDashboardToday } from "@/lib/date"
import { TIKTOK_COMMENT_PENDING_CLASSIFICATION } from "./constants"
import type {
  TikTokCommentActivityFilter,
  TikTokCommentDashboardMetrics,
  TikTokCommentDateRange,
  TikTokCommentDecisionRecord,
} from "./types"

/** Inicio del rango en hora de Lima (UTC−5 fijo, Perú no usa horario de verano). */
function rangeStart(range: TikTokCommentDateRange): Date {
  const today = getDashboardToday()
  const day = range === "today" ? today : addDaysToDateString(today, -6)
  return new Date(`${day}T00:00:00-05:00`)
}

function baseWhere(range: TikTokCommentDateRange) {
  return {
    createdAt: { gte: rangeStart(range) },
    classification: { not: TIKTOK_COMMENT_PENDING_CLASSIFICATION },
  }
}

function filterWhere(filter: TikTokCommentActivityFilter) {
  switch (filter) {
    case "replies":
      return { action: "reply", applied: true }
    case "hidden":
      return { action: "hide", applied: true }
    case "skipped":
      return { action: "skip" }
    case "errors":
      return { errorMessage: { not: null } }
    default:
      return {}
  }
}

export function toTikTokCommentDecisionRecord(row: {
  id: string
  runId: string | null
  tiktokCommentId: string
  adId: string | null
  accountId: string | null
  tiktokItemId: string | null
  identityId: string | null
  identityType: string | null
  authorName: string | null
  message: string
  classification: string
  action: string
  replyText: string | null
  applied: boolean
  errorMessage: string | null
  createdAt: Date
}): TikTokCommentDecisionRecord {
  return {
    id: row.id,
    runId: row.runId,
    tiktokCommentId: row.tiktokCommentId,
    adId: row.adId,
    accountId: row.accountId,
    tiktokItemId: row.tiktokItemId,
    identityId: row.identityId,
    identityType: row.identityType,
    authorName: row.authorName,
    message: row.message,
    classification:
      row.classification as TikTokCommentDecisionRecord["classification"],
    action: row.action as TikTokCommentDecisionRecord["action"],
    replyText: row.replyText,
    applied: row.applied,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function getTikTokCommentDashboardMetrics(
  range: TikTokCommentDateRange
): Promise<TikTokCommentDashboardMetrics> {
  const where = baseWhere(range)
  const count = (filter: TikTokCommentActivityFilter) =>
    prisma.tikTokCommentDecision.count({
      where: { ...where, ...filterWhere(filter) },
    })

  const [processed, replied, hidden, skipped, errors, lastRun] =
    await Promise.all([
      count("all"),
      count("replies"),
      count("hidden"),
      count("skipped"),
      count("errors"),
      prisma.tikTokCommentAgentRun.findFirst({
        where: { status: "success" },
        orderBy: { startedAt: "desc" },
        select: { adsScanned: true },
      }),
    ])

  return {
    range,
    processed,
    replied,
    hidden,
    skipped,
    errors,
    monitoredAds: lastRun?.adsScanned ?? 0,
  }
}

export async function listTikTokCommentActivity(input: {
  range: TikTokCommentDateRange
  filter: TikTokCommentActivityFilter
  limit?: number
}): Promise<TikTokCommentDecisionRecord[]> {
  const rows = await prisma.tikTokCommentDecision.findMany({
    where: { ...baseWhere(input.range), ...filterWhere(input.filter) },
    orderBy: { createdAt: "desc" },
    take: input.limit ?? 50,
  })
  return rows.map(toTikTokCommentDecisionRecord)
}
