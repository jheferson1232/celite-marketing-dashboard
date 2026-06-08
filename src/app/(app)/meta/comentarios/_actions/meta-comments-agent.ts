"use server"

import { createServerAction } from "@/lib/server-action"
import { getMetaCommentAgentStatus } from "@/lib/services/meta/comments/status"
import {
  listMetaCommentAgentRuns,
  listMetaCommentDecisions,
  runMetaCommentAgent,
} from "@/lib/services/meta/comments/runner"

export const getMetaCommentAgentStatusAction = createServerAction(async () =>
  getMetaCommentAgentStatus()
)

export const listMetaCommentAgentRunsAction = createServerAction(async () =>
  listMetaCommentAgentRuns(20)
)

export const listMetaCommentDecisionsAction = createServerAction(async () =>
  listMetaCommentDecisions(50)
)

export const runMetaCommentAgentNowAction = createServerAction(
  async (input: { dryRun: boolean }) =>
    runMetaCommentAgent({ trigger: "manual", dryRun: input.dryRun })
)
