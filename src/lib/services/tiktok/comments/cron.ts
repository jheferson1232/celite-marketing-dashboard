import {
  getCronSecret,
  isValidCronRequest,
} from "@/lib/services/meta/meta-telegram-cron"
import {
  runTikTokCommentAgent,
  shouldSkipScheduledTikTokCommentRun,
} from "./runner"
import type { TikTokCommentAgentTrigger } from "./types"

export { getCronSecret, isValidCronRequest }

export async function runTikTokCommentAgentCron(input: {
  dryRun?: boolean
}): Promise<{
  skipped: boolean
  runId?: string
  actionsCount?: number
  dryRun: boolean
}> {
  const trigger: TikTokCommentAgentTrigger = "cron_2h"
  const dryRun = input.dryRun ?? false

  if (await shouldSkipScheduledTikTokCommentRun(trigger)) {
    return { skipped: true, dryRun }
  }

  const result = await runTikTokCommentAgent({ trigger, dryRun })

  return {
    skipped: false,
    runId: result.runId,
    actionsCount: result.actionsCount,
    dryRun,
  }
}
