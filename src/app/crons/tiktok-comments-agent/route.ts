import { NextResponse } from "next/server"
import {
  isDryRun,
  isValidCronRequest,
  unauthorizedCronResponse,
} from "@/lib/cron-auth"
import {
  runTikTokCommentAgent,
  shouldSkipScheduledTikTokCommentRun,
} from "@/lib/services/tiktok/comments/runner"
import type { TikTokCommentAgentTrigger } from "@/lib/services/tiktok/comments/types"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const TRIGGER: TikTokCommentAgentTrigger = "cron_2h"

/** Agente de comentarios TikTok, cada 2 h (schedule `tiktok-comments-2h`). */
export async function GET(request: Request) {
  if (!isValidCronRequest(request)) return unauthorizedCronResponse()

  const dryRun = isDryRun(request)

  try {
    if (await shouldSkipScheduledTikTokCommentRun(TRIGGER)) {
      return NextResponse.json({ ok: true, skipped: true, dryRun })
    }

    const result = await runTikTokCommentAgent({ trigger: TRIGGER, dryRun })
    return NextResponse.json({
      ok: true,
      skipped: false,
      runId: result.runId,
      actionsCount: result.actionsCount,
      dryRun,
    })
  } catch (error) {
    console.error("TikTok comments agent cron:", error)
    const message =
      error instanceof Error
        ? error.message
        : "Error en cron agente comentarios TikTok"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
