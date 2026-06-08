import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { syncMetaCommentPageCatalog } from "@/lib/services/meta/comments/page-config"
import {
  exchangeCodeAndSavePages,
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
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const errorParam = url.searchParams.get("error")
  const errorDescription = url.searchParams.get("error_description")

  const cookieStore = await cookies()
  const expectedState = cookieStore.get(META_OAUTH_STATE_COOKIE)?.value
  cookieStore.delete(META_OAUTH_STATE_COOKIE)

  if (errorParam) {
    return NextResponse.redirect(
      comentariosUrl(request, {
        oauth_error:
          errorDescription ?? "El usuario canceló la autorización de Facebook.",
      })
    )
  }

  if (!code) {
    return NextResponse.redirect(
      comentariosUrl(request, {
        oauth_error: "Facebook no devolvió el código de autorización.",
      })
    )
  }

  if (!state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(
      comentariosUrl(request, {
        oauth_error: "State OAuth inválido. Intentá conectar de nuevo.",
      })
    )
  }

  try {
    const pages = await exchangeCodeAndSavePages(code)
    await syncMetaCommentPageCatalog()

    return NextResponse.redirect(
      comentariosUrl(request, {
        oauth: "success",
        count: String(pages.length),
      })
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al conectar páginas de Facebook"
    return NextResponse.redirect(comentariosUrl(request, { oauth_error: message }))
  }
}
