"use server"

import { createServerAction } from "@/lib/server-action"
import {
  getTikTokCommentDashboardMetrics,
  listTikTokCommentActivity,
} from "@/lib/services/tiktok/comments/dashboard"
import { getTikTokCommentAgentStatus } from "@/lib/services/tiktok/comments/status"
import {
  listTikTokCommentAgentRuns,
  runTikTokCommentAgent,
} from "@/lib/services/tiktok/comments/runner"
import type {
  TikTokCommentActivityFilter,
  TikTokCommentDateRange,
} from "@/lib/services/tiktok/comments/types"

export const getTikTokCommentAgentStatusAction = createServerAction(async () =>
  getTikTokCommentAgentStatus()
)

export const getTikTokCommentDashboardMetricsAction = createServerAction(
  async (range: TikTokCommentDateRange) =>
    getTikTokCommentDashboardMetrics(range)
)

export const listTikTokCommentActivityAction = createServerAction(
  async (input: {
    range: TikTokCommentDateRange
    filter: TikTokCommentActivityFilter
  }) => listTikTokCommentActivity({ ...input, limit: 50 })
)

export const listTikTokCommentAgentRunsAction = createServerAction(async () =>
  listTikTokCommentAgentRuns(20)
)

export const runTikTokCommentAgentNowAction = createServerAction(
  async (input: { dryRun: boolean }) =>
    runTikTokCommentAgent({ trigger: "manual", dryRun: input.dryRun })
)

export const listTikTokLiveCommentsAction = createServerAction(async () => {
  const { listTikTokLiveComments } = await import(
    "@/lib/services/tiktok/comments/live-comments"
  )
  return listTikTokLiveComments()
})

export const enableTikTokSparkCommentsAction = createServerAction(async () => {
  const { enableCommentsOnSparkTargetAdgroups } = await import(
    "@/lib/services/tiktok/comments/enable-comments"
  )
  return enableCommentsOnSparkTargetAdgroups()
})
