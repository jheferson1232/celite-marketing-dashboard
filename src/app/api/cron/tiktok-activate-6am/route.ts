import { NextResponse } from "next/server"
import { isValidCronRequest } from "@/lib/services/meta/meta-telegram-cron"
import { runPending6amActivations } from "@/lib/services/tiktok/agent/pending-6am-activation"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/** Cron 6:00 America/Lima (11:00 UTC): activa campañas en cola. */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")

  if (!isValidCronRequest(authHeader)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const dryRun = url.searchParams.get("dryRun") === "1"

  try {
    const result = await runPending6amActivations({ dryRun })
    return NextResponse.json({
      ok: true,
      trigger: "morning_6am",
      dryRun,
      ...result,
    })
  } catch (error) {
    console.error("TikTok activate 6am cron:", error)
    const message =
      error instanceof Error ? error.message : "Error en cron activación 6am"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
