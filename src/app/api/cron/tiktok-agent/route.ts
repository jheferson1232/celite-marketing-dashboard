import { NextResponse } from "next/server"
import {
  isValidCronRequest,
  parseTikTokAgentCronTrigger,
  runTikTokAgentCron,
} from "@/lib/services/tiktok/agent/cron"

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")

  if (!isValidCronRequest(authHeader)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const trigger =
    parseTikTokAgentCronTrigger(url.searchParams.get("trigger")) ??
    "morning_8am"
  const dryRun = url.searchParams.get("dryRun") === "1"

  try {
    const result = await runTikTokAgentCron({ trigger, dryRun })
    return NextResponse.json({ ok: true, trigger, ...result })
  } catch (error) {
    console.error("TikTok agent cron:", error)
    const message =
      error instanceof Error ? error.message : "Error en cron TikTok agent"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
