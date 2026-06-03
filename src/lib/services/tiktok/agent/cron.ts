import {
  getCronSecret,
  isValidCronRequest,
} from "@/lib/services/meta/meta-telegram-cron"
import {
  runTikTokAgent,
  shouldSkipScheduledTikTokAgentRun,
} from "./runner"
import type { TikTokAgentTrigger } from "./types"

export { getCronSecret, isValidCronRequest }

const VALID_TRIGGERS = new Set<TikTokAgentTrigger>([
  "morning_8am",
  "afternoon_2pm",
  "evening_8pm",
])

export function parseTikTokAgentCronTrigger(
  value: string | null
): TikTokAgentTrigger | null {
  if (!value) return null
  const normalized = value.trim() as TikTokAgentTrigger
  return VALID_TRIGGERS.has(normalized) ? normalized : null
}

export async function runTikTokAgentCron(input: {
  trigger: TikTokAgentTrigger
  dryRun?: boolean
}): Promise<{
  skipped: boolean
  runId?: string
  actionsCount?: number
  dryRun: boolean
}> {
  const dryRun = input.dryRun ?? false

  if (await shouldSkipScheduledTikTokAgentRun(input.trigger)) {
    return { skipped: true, dryRun }
  }

  const result = await runTikTokAgent({
    trigger: input.trigger,
    dryRun,
  })

  return {
    skipped: false,
    runId: result.runId,
    actionsCount: result.actionsCount,
    dryRun,
  }
}
