import "server-only"

import { getTikTokRequestContext } from "../tiktok-api.server"
import type { TikTokActiveAdRef } from "./types"
import type { TikTokCommentActionKind } from "./types"

export async function applyTikTokCommentAction(input: {
  commentId: string
  action: TikTokCommentActionKind
  replyText: string | null
  ad: TikTokActiveAdRef
}): Promise<{ applied: boolean; errorMessage: string | null }> {
  if (input.action === "skip") {
    return { applied: false, errorMessage: null }
  }

  try {
    const { client, advertiserId, identityId } = await getTikTokRequestContext()

    if (input.action === "hide") {
      await client.post("/comment/status/update/", {
        advertiser_id: advertiserId,
        comment_ids: [input.commentId],
        operation: "HIDE",
      })
      return { applied: true, errorMessage: null }
    }

    const message = input.replyText?.trim()
    if (!message) {
      return { applied: false, errorMessage: "Respuesta vacía" }
    }

    const replyIdentityId =
      input.ad.identityId?.trim() || identityId?.trim() || null
    const replyIdentityType =
      input.ad.identityType?.trim() ||
      (replyIdentityId ? "TT_USER" : null)

    if (!replyIdentityId || !replyIdentityType) {
      return {
        applied: false,
        errorMessage:
          "Falta identidad TikTok para responder (identity_id / identity_type)",
      }
    }

    const body: Record<string, unknown> = {
      advertiser_id: advertiserId,
      comment_id: input.commentId,
      comment_type: "REPLY",
      ad_id: input.ad.adId,
      identity_id: replyIdentityId,
      identity_type: replyIdentityType,
      text: message,
    }

    if (input.ad.tiktokItemId) {
      body.tiktok_item_id = input.ad.tiktokItemId
    }

    await client.post("/comment/post/", body)
    return { applied: true, errorMessage: null }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al aplicar acción TikTok"
    return { applied: false, errorMessage: message }
  }
}
