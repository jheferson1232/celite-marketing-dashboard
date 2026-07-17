import "server-only"

import prisma from "@/lib/prisma"
import { applyTikTokCommentAction } from "./apply-action"
import { classifyTikTokComment } from "./classify"
import { listTikTokCommentSearchUnits } from "./fetch-active-ads"
import { fetchRecentAdgroupComments } from "./fetch-comments"
import { getTikTokCommentAgentSetupMessage } from "./env"
import type {
  TikTokCommentAgentRunSummary,
  TikTokCommentAgentTrigger,
  TikTokCommentDecisionRecord,
} from "./types"

function toRunSummary(row: {
  id: string
  trigger: string
  status: string
  dryRun: boolean
  startedAt: Date
  finishedAt: Date | null
  adsScanned: number
  commentsSeen: number
  actionsCount: number
  summary: string | null
  errorMessage: string | null
}): TikTokCommentAgentRunSummary {
  return {
    runId: row.id,
    trigger: row.trigger as TikTokCommentAgentTrigger,
    status: row.status as TikTokCommentAgentRunSummary["status"],
    dryRun: row.dryRun,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    adsScanned: row.adsScanned,
    commentsSeen: row.commentsSeen,
    actionsCount: row.actionsCount,
    summary: row.summary,
    errorMessage: row.errorMessage,
  }
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

export async function listTikTokCommentAgentRuns(
  limit = 20
): Promise<TikTokCommentAgentRunSummary[]> {
  const rows = await prisma.tikTokCommentAgentRun.findMany({
    orderBy: { startedAt: "desc" },
    take: limit,
  })
  return rows.map(toRunSummary)
}

export async function listTikTokCommentDecisions(
  limit = 50
): Promise<TikTokCommentDecisionRecord[]> {
  const rows = await prisma.tikTokCommentDecision.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  })
  return rows.map(toDecisionRecord)
}

export async function runTikTokCommentAgent(input: {
  trigger: TikTokCommentAgentTrigger
  dryRun: boolean
}): Promise<TikTokCommentAgentRunSummary> {
  const setupMessage = await getTikTokCommentAgentSetupMessage()
  if (setupMessage) {
    throw new Error(setupMessage)
  }

  const run = await prisma.tikTokCommentAgentRun.create({
    data: {
      trigger: input.trigger,
      status: "running",
      dryRun: input.dryRun,
    },
  })

  try {
    const { units, adsScanned, sparkTargetAds } =
      await listTikTokCommentSearchUnits()
    const fetchErrors: string[] = []

    let commentsSeen = 0
    let actionsCount = 0

    for (const unit of units) {
      let comments: Awaited<ReturnType<typeof fetchRecentAdgroupComments>>
      try {
        comments = await fetchRecentAdgroupComments(unit.adgroupId)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Error al leer comentarios"
        fetchErrors.push(
          `${unit.ad.profileName ?? unit.ad.adName}: ${message}`
        )
        continue
      }

      for (const comment of comments) {
        const existing = await prisma.tikTokCommentDecision.findUnique({
          where: { tiktokCommentId: comment.id },
        })
        if (existing) continue

        commentsSeen += 1

        const decision = await classifyTikTokComment(comment.message)
        let applied = false
        let errorMessage: string | null = null

        if (!input.dryRun && decision.action !== "skip") {
          const result = await applyTikTokCommentAction({
            commentId: comment.id,
            action: decision.action,
            replyText: decision.replyText,
            ad: unit.ad,
          })
          applied = result.applied
          errorMessage = result.errorMessage
        }

        if (decision.action !== "skip") {
          actionsCount += 1
        }

        await prisma.tikTokCommentDecision.create({
          data: {
            runId: run.id,
            tiktokCommentId: comment.id,
            adId: comment.adId || unit.ad.adId,
            tiktokItemId: unit.ad.tiktokItemId,
            identityId: unit.ad.identityId,
            identityType: unit.ad.identityType,
            authorName: comment.authorName,
            message: comment.message,
            classification: decision.classification,
            action: decision.action,
            replyText: decision.replyText,
            applied,
            errorMessage,
          },
        })
      }
    }

    const scopeLabel =
      sparkTargetAds > 0
        ? `${sparkTargetAds} ads Spark (Urbanos/Elite) · ${units.length} adgroups`
        : `${adsScanned} ads · ${units.length} adgroups`

    const summary =
      commentsSeen === 0
        ? fetchErrors.length > 0
          ? `Sin comentarios nuevos en ${scopeLabel}. Errores API: ${fetchErrors.slice(0, 2).join(" · ")}`
          : `Sin comentarios nuevos en ${scopeLabel} (ventana 24h). Si los adgroups tenían comentarios desactivados, habilitalos y esperá comentarios nuevos.`
        : input.dryRun
          ? `${commentsSeen} comentario(s) clasificado(s); ${actionsCount} acción(es) sugerida(s) (dry run).`
          : `${commentsSeen} comentario(s) procesado(s); ${actionsCount} acción(es) en ${scopeLabel}.`

    const finished = await prisma.tikTokCommentAgentRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        adsScanned,
        commentsSeen,
        actionsCount,
        summary,
      },
    })

    return toRunSummary(finished)
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Error en agente de comentarios TikTok"
    const failed = await prisma.tikTokCommentAgentRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        errorMessage: message,
      },
    })
    return toRunSummary(failed)
  }
}

export async function shouldSkipScheduledTikTokCommentRun(
  trigger: TikTokCommentAgentTrigger
): Promise<boolean> {
  if (trigger === "manual") return false

  const since = new Date(Date.now() - 110 * 60 * 1000)
  const recent = await prisma.tikTokCommentAgentRun.findFirst({
    where: {
      trigger,
      status: { in: ["success", "running"] },
      startedAt: { gte: since },
    },
    orderBy: { startedAt: "desc" },
  })
  return recent != null
}
