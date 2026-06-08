import prisma from "@/lib/prisma"
import { assertMetaEnvConfigured } from "../meta-env"
import { applyMetaCommentAction } from "./apply-action"
import { classifyMetaComment } from "./classify"
import { fetchActiveMetaAdPosts } from "./fetch-ad-posts"
import { fetchRecentPostComments } from "./fetch-comments"
import { getMetaCommentAgentSetupMessage } from "./env"
import {
  getEnabledMetaPageAccessList,
  getPageConfigMap,
} from "./page-config"
import type {
  MetaCommentAgentRunSummary,
  MetaCommentAgentTrigger,
  MetaCommentDecisionRecord,
  MetaPageAccess,
} from "./types"

function toRunSummary(row: {
  id: string
  trigger: string
  status: string
  dryRun: boolean
  startedAt: Date
  finishedAt: Date | null
  pagesScanned: number
  postsScanned: number
  commentsSeen: number
  actionsCount: number
  summary: string | null
  errorMessage: string | null
}): MetaCommentAgentRunSummary {
  return {
    runId: row.id,
    trigger: row.trigger as MetaCommentAgentTrigger,
    status: row.status as MetaCommentAgentRunSummary["status"],
    dryRun: row.dryRun,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    pagesScanned: row.pagesScanned,
    postsScanned: row.postsScanned,
    commentsSeen: row.commentsSeen,
    actionsCount: row.actionsCount,
    summary: row.summary,
    errorMessage: row.errorMessage,
  }
}

function toDecisionRecord(row: {
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
}): MetaCommentDecisionRecord {
  return {
    id: row.id,
    runId: row.runId,
    metaCommentId: row.metaCommentId,
    postStoryId: row.postStoryId,
    adId: row.adId,
    pageId: row.pageId,
    pageName: null,
    authorName: row.authorName,
    message: row.message,
    classification: row.classification as MetaCommentDecisionRecord["classification"],
    action: row.action as MetaCommentDecisionRecord["action"],
    replyText: row.replyText,
    applied: row.applied,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
  }
}

function resolvePageTokenForPost(
  pages: MetaPageAccess[],
  pageId: string | null
): MetaPageAccess | null {
  if (pages.length === 0) return null
  if (!pageId) return pages[0] ?? null
  return pages.find((page) => page.pageId === pageId) ?? pages[0] ?? null
}

export async function listMetaCommentAgentRuns(
  limit = 20
): Promise<MetaCommentAgentRunSummary[]> {
  const rows = await prisma.metaCommentAgentRun.findMany({
    orderBy: { startedAt: "desc" },
    take: limit,
  })
  return rows.map(toRunSummary)
}

export async function listMetaCommentDecisions(
  limit = 50
): Promise<MetaCommentDecisionRecord[]> {
  const rows = await prisma.metaCommentDecision.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  })
  return rows.map(toDecisionRecord)
}

export async function runMetaCommentAgent(input: {
  trigger: MetaCommentAgentTrigger
  dryRun: boolean
}): Promise<MetaCommentAgentRunSummary> {
  assertMetaEnvConfigured()

  const setupMessage = getMetaCommentAgentSetupMessage()
  if (setupMessage) {
    throw new Error(setupMessage)
  }

  const run = await prisma.metaCommentAgentRun.create({
    data: {
      trigger: input.trigger,
      status: "running",
      dryRun: input.dryRun,
    },
  })

  try {
    const [pages, posts, pageConfigMap] = await Promise.all([
      getEnabledMetaPageAccessList(),
      fetchActiveMetaAdPosts(),
      getPageConfigMap(),
    ])

    if (pages.length === 0) {
      throw new Error(
        "No hay token de Página. Configurá META_PAGE_ACCESS_TOKEN o conectá páginas con permisos pages_manage_engagement."
      )
    }

    let commentsSeen = 0
    let actionsCount = 0

    for (const post of posts) {
      const page = resolvePageTokenForPost(pages, post.pageId)
      if (!page) continue

      const comments = await fetchRecentPostComments(
        post.postStoryId,
        page.accessToken
      )

      for (const comment of comments) {
        const existing = await prisma.metaCommentDecision.findUnique({
          where: { metaCommentId: comment.id },
        })
        if (existing) continue

        commentsSeen += 1

        const pageConfig = page.pageId
          ? pageConfigMap.get(page.pageId)
          : undefined
        const decision = await classifyMetaComment(comment.message, {
          replyMode: pageConfig?.replyMode,
          replyTemplate: pageConfig?.replyTemplate,
          websiteUrl: pageConfig?.websiteUrl,
          pageName: pageConfig?.pageName ?? page.pageName,
        })
        let applied = false
        let errorMessage: string | null = null

        if (!input.dryRun && decision.action !== "skip") {
          const result = await applyMetaCommentAction({
            commentId: comment.id,
            action: decision.action,
            replyText: decision.replyText,
            pageAccessToken: page.accessToken,
            canHide: comment.canHide,
            canReply: comment.canReply,
          })
          applied = result.applied
          errorMessage = result.errorMessage
        }

        if (decision.action !== "skip") {
          actionsCount += 1
        }

        await prisma.metaCommentDecision.create({
          data: {
            runId: run.id,
            metaCommentId: comment.id,
            postStoryId: post.postStoryId,
            adId: post.adId,
            pageId: page.pageId,
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

    const summary =
      commentsSeen === 0
        ? `Sin comentarios nuevos en ${posts.length} post(s) de ads activos (ventana 24h).`
        : input.dryRun
          ? `${commentsSeen} comentario(s) clasificado(s); ${actionsCount} acción(es) sugerida(s) (dry run).`
          : `${commentsCountLabel(commentsSeen, actionsCount)} en ${posts.length} post(s).`

    const finished = await prisma.metaCommentAgentRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        pagesScanned: pages.length,
        postsScanned: posts.length,
        commentsSeen,
        actionsCount,
        summary,
      },
    })

    return toRunSummary(finished)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error en agente de comentarios Meta"
    const failed = await prisma.metaCommentAgentRun.update({
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

function commentsCountLabel(seen: number, actions: number): string {
  return `${seen} comentario(s) procesado(s); ${actions} acción(es) aplicada(s) o intentada(s)`
}

/** Evita corridas duplicadas del cron en la misma ventana de 2h. */
export async function shouldSkipScheduledMetaCommentRun(
  trigger: MetaCommentAgentTrigger
): Promise<boolean> {
  if (trigger === "manual") return false

  const since = new Date(Date.now() - 110 * 60 * 1000)
  const recent = await prisma.metaCommentAgentRun.findFirst({
    where: {
      trigger,
      status: { in: ["success", "running"] },
      startedAt: { gte: since },
    },
    orderBy: { startedAt: "desc" },
  })
  return recent != null
}
