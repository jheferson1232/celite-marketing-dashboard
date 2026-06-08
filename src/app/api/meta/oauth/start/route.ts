import { NextResponse } from "next/server"
import {
  buildMetaOAuthLoginUrl,
  createMetaOAuthState,
  getMetaOAuthRedirectUri,
  isMetaOAuthConfigured,
  META_OAUTH_STATE_COOKIE,
} from "@/lib/services/meta/meta-oauth.server"

function comentariosUrl(request: Request, params: Record<string, string>): URL {
  const base = new URL("/meta/comentarios", request.url)
  for (const [key, value] of Object.entries(params)) {
    base.searchParams.set(key, value)
  }
  return base
}

export async function GET(request: Request) {
  if (!isMetaOAuthConfigured()) {
    return NextResponse.redirect(
      comentariosUrl(request, {
        oauth_error:
          "Configura META_APP_ID y META_APP_SECRET en las variables de entorno.",
      })
    )
  }

  try {
    const state = createMetaOAuthState()
    const loginUrl = buildMetaOAuthLoginUrl(state)
    const response = NextResponse.redirect(loginUrl)

    response.cookies.set(META_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    })

    return response
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo iniciar OAuth de Meta"
    return NextResponse.redirect(comentariosUrl(request, { oauth_error: message }))
  }
}

export async function HEAD() {
  return new NextResponse(null, {
    status: isMetaOAuthConfigured() ? 200 : 503,
    headers: {
      "x-meta-oauth-redirect": getMetaOAuthRedirectUri(),
    },
  })
}
