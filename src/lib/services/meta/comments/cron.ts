import {
  getCronSecret,
  isValidCronRequest,
} from "@/lib/services/meta/meta-telegram-cron"
import {
  runMetaCommentAgent,
  shouldSkipScheduledMetaCommentRun,
} from "./runner"
import type { MetaCommentAgentTrigger } from "./types"

export { getCronSecret, isValidCronRequest }

export async function runMetaCommentAgentCron(input: {
  dryRun?: boolean
}): Promise<{
  skipped: boolean
  runId?: string
  actionsCount?: number
  dryRun: boolean
}> {
  const trigger: MetaCommentAgentTrigger = "cron_2h"
  const dryRun = input.dryRun ?? false

  if (await shouldSkipScheduledMetaCommentRun(trigger)) {
    return { skipped: true, dryRun }
  }

  const result = await runMetaCommentAgent({ trigger, dryRun })

  return {
    skipped: false,
    runId: result.runId,
    actionsCount: result.actionsCount,
    dryRun,
  }
}
