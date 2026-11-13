import "server-only"

import prisma from "@/lib/prisma"
import { applyTikTokCommentAction } from "./apply-action"
import { classifyTikTokComment, loadTikTokClassifyContext } from "./classify"
import {
  listTikTokCommentSearchUnitsAllAccounts,
  resolveUnitAd,
} from "./fetch-active-ads"
import { fetchRecentAdgroupComments } from "./fetch-comments"
import { withTikTokDashboardAccount } from "../tiktok-dashboard-account.server"
import { mapWithConcurrency } from "../concurrency"
import {
  TIKTOK_COMMENT_CLASSIFY_CONCURRENCY,
  TIKTOK_COMMENT_FETCH_CONCURRENCY,
  TIKTOK_COMMENT_PENDING_CLASSIFICATION,
  TIKTOK_COMMENT_RUN_BUDGET_MS,
  TIKTOK_COMMENT_STALE_RUN_MS,
} from "./constants"
import { getTikTokCommentAgentSetupMessage } from "./env"
import type {
  TikTokActiveAdRef,
  TikTokCommentAgentRunSummary,
  TikTokCommentAgentTrigger,
  TikTokCommentSearchUnit,
  TikTokFetchedComment,
} from "./types"

function toRunSummary(row: {
  id: string
  trigger: string
  status: string
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
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    adsScanned: row.adsScanned,
    commentsSeen: row.commentsSeen,
    actionsCount: row.actionsCount,
    summary: row.summary,
    errorMessage: row.errorMessage,
  }
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  )
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

/**
 * Cierra corridas que Vercel cortó por timeout (quedaron en `running`) y libera
 * los comentarios que tenían reservados para que la próxima corrida los procese.
 */
async function closeStaleRuns(): Promise<void> {
  const cutoff = new Date(Date.now() - TIKTOK_COMMENT_STALE_RUN_MS)
  const stale = await prisma.tikTokCommentAgentRun.findMany({
    where: { status: "running", startedAt: { lt: cutoff } },
    select: { id: true },
  })
  if (stale.length === 0) return

  const ids = stale.map((run) => run.id)
  await prisma.tikTokCommentDecision.deleteMany({
    where: {
      runId: { in: ids },
      classification: TIKTOK_COMMENT_PENDING_CLASSIFICATION,
    },
  })
  await prisma.tikTokCommentAgentRun.updateMany({
    where: { id: { in: ids } },
    data: {
      status: "failed",
      finishedAt: new Date(),
      errorMessage:
        "La corrida superó el tiempo máximo y se cerró automáticamente.",
    },
  })
}

type Candidate = { comment: TikTokFetchedComment; ad: TikTokActiveAdRef }

async function fetchAccountCandidates(
  units: TikTokCommentSearchUnit[],
  fetchErrors: string[]
): Promise<Candidate[]> {
  const fetched = await mapWithConcurrency(
    units,
    TIKTOK_COMMENT_FETCH_CONCURRENCY,
    async (unit) => {
      try {
        return {
          unit,
          comments: await fetchRecentAdgroupComments(unit.adgroupId),
        }
      } catch (error) {
        fetchErrors.push(
          `${unit.ad.profileName ?? unit.ad.adName}: ${errorText(error, "Error al leer comentarios")}`
        )
        return { unit, comments: [] as TikTokFetchedComment[] }
      }
    }
  )

  const byId = new Map<string, Candidate>()
  for (const { unit, comments } of fetched) {
    for (const comment of comments) {
      if (byId.has(comment.id)) continue
      byId.set(comment.id, { comment, ad: resolveUnitAd(unit, comment.adId) })
    }
  }
  if (byId.size === 0) return []

  const existing = await prisma.tikTokCommentDecision.findMany({
    where: { tiktokCommentId: { in: [...byId.keys()] } },
    select: { tiktokCommentId: true },
  })
  for (const row of existing) byId.delete(row.tiktokCommentId)
  return [...byId.values()]
}

/**
 * Reserva el comentario antes de llamar a la IA y a TikTok. Si otra corrida ya lo
 * tomó, el unique de `tiktokCommentId` falla y se salta (evita responder dos veces).
 */
async function reserveComment(
  runId: string,
  { comment, ad }: Candidate
): Promise<string | null> {
  try {
    const row = await prisma.tikTokCommentDecision.create({
      data: {
        runId,
        tiktokCommentId: comment.id,
        adId: ad.adId,
        accountId: ad.accountId,
        tiktokItemId: ad.tiktokItemId,
        identityId: ad.identityId,
        identityType: ad.identityType,
        authorName: comment.authorName,
        message: comment.message,
        classification: TIKTOK_COMMENT_PENDING_CLASSIFICATION,
        action: "skip",
      },
      select: { id: true },
    })
    return row.id
  } catch (error) {
    if (isUniqueViolation(error)) return null
    throw error
  }
}

export async function runTikTokCommentAgent(input: {
  trigger: TikTokCommentAgentTrigger
}): Promise<TikTokCommentAgentRunSummary> {
  const setupMessage = await getTikTokCommentAgentSetupMessage()
  if (setupMessage) {
    throw new Error(setupMessage)
  }

  await closeStaleRuns()
  const active = await prisma.tikTokCommentAgentRun.findFirst({
    where: { status: "running" },
    select: { id: true },
  })
  if (active) {
    throw new Error("Ya hay una corrida en curso. Esperá a que termine.")
  }

  const run = await prisma.tikTokCommentAgentRun.create({
    data: { trigger: input.trigger, status: "running" },
  })
  const deadline = Date.now() + TIKTOK_COMMENT_RUN_BUDGET_MS

  try {
    const [{ units, adsScanned, sparkTargetAds }, classifyContext] =
      await Promise.all([
        listTikTokCommentSearchUnitsAllAccounts(),
        loadTikTokClassifyContext(),
      ])

    const fetchErrors: string[] = []
    const classifyErrors: string[] = []
    let commentsSeen = 0
    let actionsCount = 0
    let applyErrors = 0
    let deferred = 0

    const unitsByAccount = new Map<string, TikTokCommentSearchUnit[]>()
    for (const unit of units) {
      const key = unit.ad.accountId ?? "__current__"
      const list = unitsByAccount.get(key)
      if (list) list.push(unit)
      else unitsByAccount.set(key, [unit])
    }

    const processCandidate = async (candidate: Candidate) => {
      if (Date.now() > deadline) {
        deferred += 1
        return
      }

      const decisionId = await reserveComment(run.id, candidate)
      if (!decisionId) return

      let decision: Awaited<ReturnType<typeof classifyTikTokComment>>
      try {
        decision = await classifyTikTokComment(
          candidate.comment.message,
          classifyContext
        )
      } catch (error) {
        // Se libera para que la próxima corrida lo vuelva a intentar.
        await prisma.tikTokCommentDecision
          .delete({ where: { id: decisionId } })
          .catch(() => undefined)
        classifyErrors.push(errorText(error, "Error al clasificar"))
        return
      }

      commentsSeen += 1
      let applied = false
      let errorMessage: string | null = null

      if (decision.action !== "skip") {
        actionsCount += 1
        const result = await applyTikTokCommentAction({
          commentId: candidate.comment.id,
          action: decision.action,
          replyText: decision.replyText,
          ad: candidate.ad,
        })
        applied = result.applied
        errorMessage = result.errorMessage
        if (errorMessage) applyErrors += 1
      }

      await prisma.tikTokCommentDecision.update({
        where: { id: decisionId },
        data: {
          classification: decision.classification,
          action: decision.action,
          replyText: decision.replyText,
          applied,
          errorMessage,
        },
      })
    }

    for (const [accountId, accountUnits] of unitsByAccount) {
      if (Date.now() > deadline) break

      const processAccount = async () => {
        const candidates = await fetchAccountCandidates(
          accountUnits,
          fetchErrors
        )
        await mapWithConcurrency(
          candidates,
          TIKTOK_COMMENT_CLASSIFY_CONCURRENCY,
          processCandidate
        )
      }

      if (accountId === "__current__") {
        await processAccount()
      } else {
        await withTikTokDashboardAccount(accountId, processAccount)
      }
    }

    if (classifyErrors.length > 0 && commentsSeen === 0) {
      throw new Error(`La IA no pudo clasificar: ${classifyErrors[0]}`)
    }

    const scopeLabel =
      sparkTargetAds > 0
        ? `${sparkTargetAds} ads Spark · ${units.length} conjuntos`
        : `${adsScanned} ads · ${units.length} conjuntos`

    const parts: string[] = []
    if (commentsSeen === 0) {
      parts.push(`Sin comentarios nuevos en ${scopeLabel} (ventana 7 días).`)
    } else {
      parts.push(
        `${commentsSeen} comentario(s) procesado(s); ${actionsCount} acción(es) en ${scopeLabel}.`
      )
    }
    if (applyErrors > 0) {
      parts.push(`${applyErrors} acción(es) fallaron en TikTok.`)
    }
    if (classifyErrors.length > 0) {
      parts.push(
        `${classifyErrors.length} sin clasificar (se reintentan en la próxima corrida).`
      )
    }
    if (deferred > 0) {
      parts.push(
        `${deferred} quedaron pendientes por tiempo; ejecutá de nuevo para seguir.`
      )
    }
    if (fetchErrors.length > 0) {
      parts.push(`Errores API: ${fetchErrors.slice(0, 2).join(" · ")}`)
    }

    const finished = await prisma.tikTokCommentAgentRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        adsScanned,
        commentsSeen,
        actionsCount,
        summary: parts.join(" "),
      },
    })

    return toRunSummary(finished)
  } catch (error) {
    await prisma.tikTokCommentDecision.deleteMany({
      where: {
        runId: run.id,
        classification: TIKTOK_COMMENT_PENDING_CLASSIFICATION,
      },
    })
    const failed = await prisma.tikTokCommentAgentRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        errorMessage: errorText(error, "Error en agente de comentarios TikTok"),
      },
    })
    return toRunSummary(failed)
  }
}
