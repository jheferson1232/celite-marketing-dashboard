import "server-only"

import {
  AI_GATEWAY_API_KEY_ENV,
  getCommentAgentModelLabel,
  isAiGatewayConfigured,
} from "@/lib/services/ai/comment-model"
import { listTikTokAdAccounts } from "../ad-accounts"
import { hasTikTokCredentialsConfigured } from "../tiktok-credentials.server"
import type { TikTokCommentAgentStatus } from "./types"

export async function getTikTokCommentAgentStatus(): Promise<TikTokCommentAgentStatus> {
  const missing: string[] = []
  const aiConfigured = isAiGatewayConfigured()
  if (!aiConfigured) missing.push(AI_GATEWAY_API_KEY_ENV)

  const [tiktokConfigured, accounts] = await Promise.all([
    hasTikTokCredentialsConfigured().catch(() => false),
    listTikTokAdAccounts().catch(() => []),
  ])
  if (!tiktokConfigured) {
    missing.push("TIKTOK_ACCESS_TOKEN / TIKTOK_ADVERTISER_ID")
  }

  return {
    aiConfigured,
    aiModelLabel: getCommentAgentModelLabel(),
    tiktokConfigured,
    accountsCount: tiktokConfigured ? Math.max(accounts.length, 1) : 0,
    missing,
  }
}
