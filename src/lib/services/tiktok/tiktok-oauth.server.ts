import "server-only"

import crypto from "crypto"
import axios from "axios"

const TIKTOK_OAUTH_PORTAL = "https://business-api.tiktok.com/portal/auth"
const TIKTOK_ADS_LOGIN = "https://ads.tiktok.com/i18n/login"
const TIKTOK_OAUTH_STATE_COOKIE = "tiktok_oauth_state"

export type TikTokOAuthConfig = {
  appId: string
  appSecret: string
  redirectUri: string
}

export type TikTokOAuthTokenResult = {
  accessToken: string
  refreshToken: string | null
  advertiserIds: string[]
}

export function isTikTokOAuthConfigured(): boolean {
  return Boolean(
    process.env.TIKTOK_APP_ID?.trim() && process.env.TIKTOK_APP_SECRET?.trim()
  )
}

export function getTikTokOAuthRedirectUri(): string {
  const fromEnv = process.env.TIKTOK_OAUTH_REDIRECT_URI?.trim()
  if (fromEnv) return fromEnv

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (appUrl) {
    return `${appUrl.replace(/\/$/, "")}/api/tiktok/oauth/callback`
  }

  const vercelUrl = process.env.VERCEL_URL?.trim()
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/\/$/, "")}/api/tiktok/oauth/callback`
  }

  return "http://localhost:3000/api/tiktok/oauth/callback"
}

export function getTikTokOAuthConfig(): TikTokOAuthConfig {
  const appId = process.env.TIKTOK_APP_ID?.trim()
  const appSecret = process.env.TIKTOK_APP_SECRET?.trim()

  if (!appId || !appSecret) {
    throw new Error(
      "Faltan TIKTOK_APP_ID y TIKTOK_APP_SECRET. Configuralos en .env (app de TikTok Marketing API)."
    )
  }

  return {
    appId,
    appSecret,
    redirectUri: getTikTokOAuthRedirectUri(),
  }
}

export function createTikTokOAuthState(): string {
  return crypto.randomBytes(24).toString("hex")
}

export { TIKTOK_OAUTH_STATE_COOKIE }

/** URL de login TikTok Ads → portal OAuth (mismo flujo que Auto Pilot). */
export function buildTikTokOAuthLoginUrl(state: string): string {
  const { appId, redirectUri } = getTikTokOAuthConfig()

  const portalAuthUrl = new URL(TIKTOK_OAUTH_PORTAL)
  portalAuthUrl.searchParams.set("app_id", appId)
  portalAuthUrl.searchParams.set("state", state)
  portalAuthUrl.searchParams.set("redirect_uri", redirectUri)

  const loginUrl = new URL(TIKTOK_ADS_LOGIN)
  loginUrl.searchParams.set("redirect", portalAuthUrl.toString())
  loginUrl.searchParams.set("_source_", "marketing_api")

  return loginUrl.toString()
}

/** Acepta el auth_code crudo o una URL de callback que lo incluya. */
export function parseTikTokAuthCode(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error("Pegá el código de autorización de TikTok.")
  }

  try {
    const fromUrl = new URL(trimmed)
    const code =
      fromUrl.searchParams.get("auth_code")?.trim() ||
      fromUrl.searchParams.get("code")?.trim()
    if (code) return code
  } catch {
    // no es URL; tratar como código directo
  }

  const queryMatch = trimmed.match(/[?&#]auth_code=([^&#\s]+)/i)
  if (queryMatch?.[1]) {
    return decodeURIComponent(queryMatch[1])
  }

  return trimmed
}

export async function exchangeTikTokOAuthCode(
  authCode: string
): Promise<TikTokOAuthTokenResult> {
  const { appId, appSecret } = getTikTokOAuthConfig()
  const code = parseTikTokAuthCode(authCode)

  const { data } = await axios.post<{
    code?: number
    message?: string
    data?: {
      access_token?: string
      refresh_token?: string
      advertiser_ids?: string[]
    }
  }>(
    "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/",
    {
      app_id: appId,
      secret: appSecret,
      auth_code: code,
    },
    { headers: { "Content-Type": "application/json" } }
  )

  if (data.code !== 0 || !data.data?.access_token) {
    throw new Error(data.message || "TikTok rechazó el intercambio del auth_code")
  }

  const advertiserIds = (data.data.advertiser_ids ?? [])
    .map((id) => String(id).trim())
    .filter((id) => /^\d+$/.test(id))

  return {
    accessToken: data.data.access_token,
    refreshToken: data.data.refresh_token?.trim() || null,
    advertiserIds,
  }
}
