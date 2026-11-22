import "server-only"

import { getCommentAgentModel } from "@/lib/services/ai/comment-model"
import { getOrCreateMetaCommentAgentSettings } from "@/lib/services/meta/comments/agent-settings"
import {
  classifyMetaComment,
  type MetaCommentClassifyContext,
} from "@/lib/services/meta/comments/classify"
import { listActiveMetaCommentProducts } from "@/lib/services/meta/comments/products"
import type {
  TikTokCommentActionKind,
  TikTokCommentClassification,
} from "./types"

export type TikTokClassifyContext = MetaCommentClassifyContext

/** Prompts y catálogo compartidos con Comentarios IA (Meta). Cargar una vez por corrida. */
export async function loadTikTokClassifyContext(): Promise<TikTokClassifyContext> {
  const [agentSettings, products] = await Promise.all([
    getOrCreateMetaCommentAgentSettings(),
    listActiveMetaCommentProducts(),
  ])
  return { pageName: "TikTok", agentSettings, products }
}

export async function classifyTikTokComment(
  message: string,
  context: TikTokClassifyContext
): Promise<{
  classification: TikTokCommentClassification
  action: TikTokCommentActionKind
  replyText: string | null
}> {
  return classifyMetaComment(message, context, { model: getCommentAgentModel() })
}
