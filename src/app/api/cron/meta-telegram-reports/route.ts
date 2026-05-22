import { NextResponse } from "next/server"
import {
  isValidCronRequest,
  runMetaTelegramCron,
} from "@/lib/services/meta/meta-telegram-cron"

export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")

  if (!isValidCronRequest(authHeader)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await runMetaTelegramCron()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("Meta telegram cron:", error)
    const message =
      error instanceof Error ? error.message : "Error en cron Meta"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
