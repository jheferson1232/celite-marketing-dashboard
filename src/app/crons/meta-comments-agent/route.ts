import { NextResponse } from "next/server"
import {
  isDryRun,
  isValidCronRequest,
  unauthorizedCronResponse,
} from "@/lib/cron-auth"
import {
  runMetaCommentAgent,
  shouldSkipScheduledMetaCommentRun,
} from "@/lib/services/meta/comments/runner"
import type { MetaCommentAgentTrigger } from "@/lib/services/meta/comments/types"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const TRIGGER: MetaCommentAgentTrigger = "cron_2h"

/** Agente de comentarios Meta, cada 2 h (schedule `meta-comments-2h`). */
export async function GET(request: Request) {
  if (!isValidCronRequest(request)) return unauthorizedCronResponse()

  const dryRun = isDryRun(request)

  try {
    if (await shouldSkipScheduledMetaCommentRun(TRIGGER)) {
      return NextResponse.json({ ok: true, skipped: true, dryRun })
    }

    const result = await runMetaCommentAgent({ trigger: TRIGGER, dryRun })
    return NextResponse.json({
      ok: true,
      skipped: false,
      runId: result.runId,
      actionsCount: result.actionsCount,
      dryRun,
    })
  } catch (error) {
    console.error("Meta comments agent cron:", error)
    const message =
      error instanceof Error
        ? error.message
        : "Error en cron agente comentarios Meta"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
