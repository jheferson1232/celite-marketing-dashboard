import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { connectTikTokAdAccountsFromOAuth } from "@/lib/services/tiktok/ad-accounts"
import { clearTikTokCache } from "@/lib/services/tiktok/tiktok-cache"
import {
  exchangeTikTokOAuthCode,
  TIKTOK_OAUTH_STATE_COOKIE,
} from "@/lib/services/tiktok/tiktok-oauth.server"

function cuentasUrl(request: Request, params: Record<string, string>): URL {
  const base = new URL("/tiktok/cuentas", request.url)
  for (const [key, value] of Object.entries(params)) {
    base.searchParams.set(key, value)
  }
  return base
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const authCode = url.searchParams.get("auth_code")
  const state = url.searchParams.get("state")
  const cookieStore = await cookies()
  const expectedState = cookieStore.get(TIKTOK_OAUTH_STATE_COOKIE)?.value

  cookieStore.delete(TIKTOK_OAUTH_STATE_COOKIE)

  if (!authCode) {
    return NextResponse.redirect(
      cuentasUrl(request, {
        oauth_error: "TikTok no devolvió auth_code. Cancelaste o falló la autorización.",
      })
    )
  }

  if (!state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(
      cuentasUrl(request, {
        oauth_error: "State OAuth inválido. Volvé a intentar conectar la cuenta.",
      })
    )
  }

  try {
    const token = await exchangeTikTokOAuthCode(authCode)
    const connected = await connectTikTokAdAccountsFromOAuth({
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      advertiserIds: token.advertiserIds,
    })
    clearTikTokCache()

    return NextResponse.redirect(
      cuentasUrl(request, {
        oauth: "success",
        count: String(connected.length),
      })
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al conectar cuentas TikTok"
    return NextResponse.redirect(cuentasUrl(request, { oauth_error: message }))
  }
}
