import { NextResponse } from "next/server"
import {
  isDryRun,
  isValidCronRequest,
  unauthorizedCronResponse,
} from "@/lib/cron-auth"
import {
  runTikTokAgent,
  shouldSkipScheduledTikTokAgentRun,
} from "@/lib/services/tiktok/agent/runner"
import type { TikTokAgentTrigger } from "@/lib/services/tiktok/agent/types"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/** Nombre del schedule en vercel.json → trigger del agente. */
const SCHEDULE_TRIGGERS: Record<string, TikTokAgentTrigger> = {
  "tiktok-agent-8am": "morning_8am",
  "tiktok-agent-2pm": "afternoon_2pm",
  "tiktok-agent-8pm": "evening_8pm",
}

const VALID_TRIGGERS = new Set<string>(Object.values(SCHEDULE_TRIGGERS))

/**
 * Vercel Schedules envía el nombre del schedule en `ce-vssschedulename`.
 * En llamadas manuales se usa `?trigger=morning_8am|afternoon_2pm|evening_8pm`.
 */
function resolveTrigger(request: Request): TikTokAgentTrigger {
  const scheduleName = request.headers.get("ce-vssschedulename")?.trim()
  if (scheduleName && SCHEDULE_TRIGGERS[scheduleName]) {
    return SCHEDULE_TRIGGERS[scheduleName]
  }

  const param = new URL(request.url).searchParams.get("trigger")?.trim()
  if (param && VALID_TRIGGERS.has(param)) return param as TikTokAgentTrigger

  return "morning_8am"
}

/** Agente TikTok 8:00 / 14:00 / 20:00 Lima. */
export async function GET(request: Request) {
  if (!isValidCronRequest(request)) return unauthorizedCronResponse()

  const trigger = resolveTrigger(request)
  const dryRun = isDryRun(request)

  try {
    if (await shouldSkipScheduledTikTokAgentRun(trigger)) {
      return NextResponse.json({ ok: true, trigger, skipped: true, dryRun })
    }

    const result = await runTikTokAgent({ trigger, dryRun })
    return NextResponse.json({
      ok: true,
      trigger,
      skipped: false,
      runId: result.runId,
      actionsCount: result.actionsCount,
      dryRun,
    })
  } catch (error) {
    console.error("TikTok agent cron:", error)
    const message =
      error instanceof Error ? error.message : "Error en cron TikTok agent"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
