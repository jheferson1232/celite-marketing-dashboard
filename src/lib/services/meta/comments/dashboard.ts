import prisma from "@/lib/prisma"
import { getMonitoredPageCount, getPageConfigMap } from "./page-config"
import type {
  MetaCommentActivityFilter,
  MetaCommentDashboardMetrics,
  MetaCommentDateRange,
  MetaCommentDecisionRecord,
} from "./types"

function rangeStart(range: MetaCommentDateRange): Date {
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

function actionFilterWhere(filter: MetaCommentActivityFilter) {
  if (filter === "replies") return { action: "reply" as const }
  if (filter === "deleted") return { action: "hide" as const }
  return {}
}

function toDecisionRecord(
  row: {
    id: string
    runId: string | null
    metaCommentId: string
    postStoryId: string | null
    adId: string | null
    pageId: string | null
    authorName: string | null
    message: string
    classification: string
    action: string
    replyText: string | null
    applied: boolean
    errorMessage: string | null
    createdAt: Date
  },
  pageName: string | null
): MetaCommentDecisionRecord {
  return {
    id: row.id,
    runId: row.runId,
    metaCommentId: row.metaCommentId,
    postStoryId: row.postStoryId,
    adId: row.adId,
    pageId: row.pageId,
    pageName,
    authorName: row.authorName,
    message: row.message,
    classification:
      row.classification as MetaCommentDecisionRecord["classification"],
    action: row.action as MetaCommentDecisionRecord["action"],
    replyText: row.replyText,
    applied: row.applied,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function getMetaCommentDashboardMetrics(
  range: MetaCommentDateRange
): Promise<MetaCommentDashboardMetrics> {
  const since = rangeStart(range)

  const [totalActivity, deletedComments, repliedComments, errors, monitoredPages] =
    await Promise.all([
      prisma.metaCommentDecision.count({
        where: { createdAt: { gte: since } },
      }),
      prisma.metaCommentDecision.count({
        where: { createdAt: { gte: since }, action: "hide" },
      }),
      prisma.metaCommentDecision.count({
        where: { createdAt: { gte: since }, action: "reply" },
      }),
      prisma.metaCommentDecision.count({
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
      getMonitoredPageCount(),
    ])

  return {
    range,
    totalActivity,
    deletedComments,
    repliedComments,
    errors,
    monitoredPages,
  }
}

export async function listMetaCommentActivity(input: {
  range: MetaCommentDateRange
  filter: MetaCommentActivityFilter
  limit?: number
}): Promise<MetaCommentDecisionRecord[]> {
  const since = rangeStart(input.range)
  const limit = input.limit ?? 50
  const pageMap = await getPageConfigMap()

  const rows = await prisma.metaCommentDecision.findMany({
    where: {
      createdAt: { gte: since },
      ...actionFilterWhere(input.filter),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  return rows.map((row) =>
    toDecisionRecord(
      row,
      row.pageId ? (pageMap.get(row.pageId)?.pageName ?? null) : null
    )
  )
}
