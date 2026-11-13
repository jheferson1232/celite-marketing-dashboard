import {
  AI_GATEWAY_API_KEY_ENV,
  isAiGatewayConfigured,
} from "@/lib/services/ai/comment-model"
import { hasTikTokCredentialsConfigured } from "../tiktok-credentials.server"

export async function getTikTokCommentAgentSetupMessage(): Promise<string> {
  const missing: string[] = []
  if (!isAiGatewayConfigured()) {
    missing.push(AI_GATEWAY_API_KEY_ENV)
  }
  const hasTikTok = await hasTikTokCredentialsConfigured()
  if (!hasTikTok) {
    missing.push("TIKTOK_ACCESS_TOKEN / TIKTOK_ADVERTISER_ID")
  }
  if (missing.length === 0) return ""
  return `Faltan variables o cuenta TikTok: ${missing.join(", ")}. Conectá una cuenta en Cuentas TikTok Ads o configurá las variables en Vercel.`
}
