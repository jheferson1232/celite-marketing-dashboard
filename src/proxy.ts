import { NextResponse, type NextRequest } from "next/server"
import {
  getAppPassword,
  safeRedirectPath,
  SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/auth/session"

/**
 * Rutas que no pasan por el login. Cada una tiene su propia protección:
 * - /crons/*: Authorization: Bearer CRON_SECRET (Vercel Schedules lo envía)
 * - /api/telegram/webhook: x-telegram-bot-api-secret-token (obligatorio)
 * - /api/health/*: solo responden { configured: boolean }
 */
const PUBLIC_PREFIXES = ["/crons/", "/api/health/"]
const PUBLIC_PATHS = new Set(["/login", "/api/telegram/webhook"])

function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  )
}

/**
 * Las server actions se ejecutan con POST a la ruta de la página. Las deja
 * pasar: `createServerAction` exige la sesión y devuelve un error que el
 * cliente convierte en redirección al login (un 401 aquí rompería ese flujo).
 */
function isServerActionRequest(request: NextRequest): boolean {
  return (
    request.method === "POST" &&
    request.headers.has("next-action") &&
    !request.nextUrl.pathname.startsWith("/api/")
  )
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (isPublicPath(pathname) || isServerActionRequest(request)) {
    return NextResponse.next()
  }

  const authenticated = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value,
    getAppPassword()
  )

  if (authenticated) {
    return NextResponse.next()
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const loginUrl = new URL("/login", request.url)
  // Sin `next` (p. ej. al entrar a `/`), el login lleva a DEFAULT_AFTER_LOGIN_PATH.
  const next = safeRedirectPath(`${pathname}${search}`, "")
  if (next) loginUrl.searchParams.set("next", next)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|avif)$).*)",
  ],
}
