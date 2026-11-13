import "server-only"

import prisma from "@/lib/prisma"
import { applyTikTokCommentAction } from "./apply-action"
import { toTikTokCommentDecisionRecord } from "./dashboard"
import type {
  TikTokCommentActionKind,
  TikTokCommentDecisionRecord,
} from "./types"

/** Vuelve a aplicar en TikTok una decisión que falló (ocultar o responder). */
export async function retryTikTokCommentDecision(
  decisionId: string
): Promise<TikTokCommentDecisionRecord> {
  const row = await prisma.tikTokCommentDecision.findUnique({
    where: { id: decisionId },
  })
  if (!row) throw new Error("No se encontró el comentario")
  if (row.applied) throw new Error("La acción ya está aplicada en TikTok")
  if (row.action !== "hide" && row.action !== "reply") {
    throw new Error("Este comentario no tiene acción para reintentar")
  }
  if (!row.adId) throw new Error("Falta el anuncio del comentario")

  const result = await applyTikTokCommentAction({
    commentId: row.tiktokCommentId,
    action: row.action as TikTokCommentActionKind,
    replyText: row.replyText,
    ad: {
      adId: row.adId,
      adName: row.adId,
      adgroupId: null,
      tiktokItemId: row.tiktokItemId,
      identityId: row.identityId,
      identityType: row.identityType,
      videoId: null,
      profileName: null,
      isSparkTarget: true,
      accountId: row.accountId,
      accountName: null,
    },
  })

  const updated = await prisma.tikTokCommentDecision.update({
    where: { id: row.id },
    data: { applied: result.applied, errorMessage: result.errorMessage },
  })
  return toTikTokCommentDecisionRecord(updated)
}
