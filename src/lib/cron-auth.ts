import { NextResponse } from "next/server"

/**
 * Auth compartida de las rutas `/crons/*`. Vercel Schedules envía
 * `Authorization: Bearer <CRON_SECRET>` cuando la variable existe en el proyecto.
 */
export function isValidCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) return false
  return authHeader.slice(7).trim() === secret
}

export function unauthorizedCronResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

export function isDryRun(request: Request): boolean {
  return new URL(request.url).searchParams.get("dryRun") === "1"
}
