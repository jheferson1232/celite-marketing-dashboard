import { isAnthropicConfigured } from "@/lib/services/meta/comments/env"
import { hasTikTokCredentialsConfigured } from "../tiktok-credentials.server"

export async function getTikTokCommentAgentSetupMessage(): Promise<string> {
  const missing: string[] = []
  if (!isAnthropicConfigured()) {
    missing.push("ANTHROPIC_API_KEY")
  }
  const hasTikTok = await hasTikTokCredentialsConfigured()
  if (!hasTikTok) {
    missing.push("TIKTOK_ACCESS_TOKEN / TIKTOK_ADVERTISER_ID")
  }
  if (missing.length === 0) return ""
  return `Faltan variables o cuenta TikTok: ${missing.join(", ")}. Conectá una cuenta en Cuentas TikTok Ads o configurá el token en .env.`
}
