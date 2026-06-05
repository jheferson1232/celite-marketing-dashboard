import { NextResponse } from "next/server"
import {
  buildTikTokOAuthLoginUrl,
  createTikTokOAuthState,
  getTikTokOAuthRedirectUri,
  isTikTokOAuthConfigured,
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
  if (!isTikTokOAuthConfigured()) {
    return NextResponse.redirect(
      cuentasUrl(request, {
        oauth_error:
          "Configura TIKTOK_APP_ID y TIKTOK_APP_SECRET en el servidor (app TikTok Marketing API).",
      })
    )
  }

  try {
    const state = createTikTokOAuthState()
    const loginUrl = buildTikTokOAuthLoginUrl(state)
    const response = NextResponse.redirect(loginUrl)

    response.cookies.set(TIKTOK_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    })

    return response
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo iniciar OAuth TikTok"
    return NextResponse.redirect(cuentasUrl(request, { oauth_error: message }))
  }
}

export async function HEAD() {
  return new NextResponse(null, {
    status: isTikTokOAuthConfigured() ? 200 : 503,
    headers: {
      "x-tiktok-oauth-redirect": getTikTokOAuthRedirectUri(),
    },
  })
}
