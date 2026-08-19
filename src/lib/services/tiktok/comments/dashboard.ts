import "server-only"

import prisma from "@/lib/prisma"
import { listTikTokCommentSearchUnitsAllAccounts } from "./fetch-active-ads"
import type {
  TikTokCommentActivityFilter,
  TikTokCommentDashboardMetrics,
  TikTokCommentDateRange,
  TikTokCommentDecisionRecord,
} from "./types"

function rangeStart(range: TikTokCommentDateRange): Date {
  const now = new Date()
  if (range === "today") {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    return start
  }
  const start = new Date(now)
  start.setDate(start.getDate() - 7)
  start.setHours(0, 0, 0, 0)
  return start
}

function actionFilterWhere(filter: TikTokCommentActivityFilter) {
  if (filter === "replies") return { action: "reply" as const }
  if (filter === "deleted") return { action: "hide" as const }
  return {}
}

function toDecisionRecord(row: {
  id: string
  runId: string | null
  tiktokCommentId: string
  adId: string | null
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
  const since = rangeStart(range)

  const [totalActivity, deletedComments, repliedComments, errors, searchUnits] =
    await Promise.all([
      prisma.tikTokCommentDecision.count({
        where: { createdAt: { gte: since } },
      }),
      prisma.tikTokCommentDecision.count({
        where: { createdAt: { gte: since }, action: "hide" },
      }),
      prisma.tikTokCommentDecision.count({
        where: { createdAt: { gte: since }, action: "reply" },
      }),
      prisma.tikTokCommentDecision.count({
        where: {
          createdAt: { gte: since },
          OR: [
            { errorMessage: { not: null } },
            {
              applied: false,
              action: { in: ["hide", "reply"] },
            },
          ],
        },
      }),
      listTikTokCommentSearchUnitsAllAccounts()
        .then((r) => r.adsScanned)
        .catch(() => 0),
    ])

  return {
    range,
    totalActivity,
    deletedComments,
    repliedComments,
    errors,
    monitoredAds: searchUnits,
  }
}

export async function listTikTokCommentActivity(input: {
  range: TikTokCommentDateRange
  filter: TikTokCommentActivityFilter
  limit?: number
}): Promise<TikTokCommentDecisionRecord[]> {
  const since = rangeStart(input.range)
  const limit = input.limit ?? 50

  const rows = await prisma.tikTokCommentDecision.findMany({
    where: {
      createdAt: { gte: since },
      ...actionFilterWhere(input.filter),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  return rows.map(toDecisionRecord)
}
