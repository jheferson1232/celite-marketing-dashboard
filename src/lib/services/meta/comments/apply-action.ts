import { metaGraphPostJson } from "./meta-graph-mutate"
import type { MetaCommentActionKind } from "./types"

export async function applyMetaCommentAction(input: {
  commentId: string
  action: MetaCommentActionKind
  replyText: string | null
  pageAccessToken: string
  canHide: boolean
  canReply: boolean
}): Promise<{ applied: boolean; errorMessage: string | null }> {
  try {
    if (input.action === "hide") {
      if (!input.canHide) {
        return {
          applied: false,
          errorMessage: "Sin permiso can_hide en este comentario",
        }
      }
      await metaGraphPostJson<{ success?: boolean }>(
        input.commentId,
        { is_hidden: "true" },
        input.pageAccessToken
      )
      return { applied: true, errorMessage: null }
    }

    if (input.action === "reply") {
      if (!input.canReply) {
        return {
          applied: false,
          errorMessage: "Sin permiso para responder este comentario",
        }
      }
      const message = input.replyText?.trim()
      if (!message) {
        return { applied: false, errorMessage: "Respuesta vacía" }
      }
      await metaGraphPostJson<{ id?: string }>(
        `${input.commentId}/comments`,
        { message },
        input.pageAccessToken
      )
      return { applied: true, errorMessage: null }
    }

    return { applied: false, errorMessage: null }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al aplicar acción"
    return { applied: false, errorMessage: message }
  }
}
