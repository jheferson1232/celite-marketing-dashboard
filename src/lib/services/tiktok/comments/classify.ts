import "server-only"

import { getOrCreateMetaCommentAgentSettings } from "@/lib/services/meta/comments/agent-settings"
import { classifyMetaComment } from "@/lib/services/meta/comments/classify"
import { listActiveMetaCommentProducts } from "@/lib/services/meta/comments/products"
import type {
  TikTokCommentActionKind,
  TikTokCommentClassification,
} from "./types"

export async function classifyTikTokComment(
  message: string
): Promise<{
  classification: TikTokCommentClassification
  action: TikTokCommentActionKind
  replyText: string | null
}> {
  const [agentSettings, products] = await Promise.all([
    getOrCreateMetaCommentAgentSettings(),
    listActiveMetaCommentProducts(),
  ])

  return classifyMetaComment(message, {
    pageName: "TikTok",
    agentSettings,
    products,
  })
}
