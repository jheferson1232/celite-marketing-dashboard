import "server-only"

import { isAnthropicConfigured } from "@/lib/services/meta/comments/env"
import { resolveTikTokCredentials } from "../tiktok-credentials.server"
import type { TikTokCommentAgentStatus } from "./types"

export async function getTikTokCommentAgentStatus(): Promise<TikTokCommentAgentStatus> {
  const missing: string[] = []
  if (!isAnthropicConfigured()) missing.push("ANTHROPIC_API_KEY")

  let tiktokConfigured = false
  let advertiserId: string | null = null
  let advertiserName: string | null = null

  try {
    const creds = await resolveTikTokCredentials()
    tiktokConfigured = true
    advertiserId = creds.advertiserId
    advertiserName = creds.advertiserId
  } catch {
    missing.push("TIKTOK_ACCESS_TOKEN / TIKTOK_ADVERTISER_ID")
  }

  return {
    anthropicConfigured: isAnthropicConfigured(),
    tiktokConfigured,
    advertiserId,
    advertiserName,
    missing: [...new Set(missing)],
  }
}
