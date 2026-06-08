"use server"

import { createServerAction } from "@/lib/server-action"
import {
  getMetaCommentDashboardMetrics,
  listMetaCommentActivity,
} from "@/lib/services/meta/comments/dashboard"
import {
  getMetaCommentPageMonitoringState,
  listMetaCommentPageConfigs,
  setAllMetaCommentPagesEnabled,
  setMetaCommentPageEnabled,
  syncMetaCommentPageCatalog,
  updateMetaCommentPageReply,
} from "@/lib/services/meta/comments/page-config"
import { getMetaCommentAgentStatus } from "@/lib/services/meta/comments/status"
import {
  listMetaCommentAgentRuns,
  runMetaCommentAgent,
} from "@/lib/services/meta/comments/runner"
import type {
  MetaCommentActivityFilter,
  MetaCommentDateRange,
  MetaCommentPageReplyUpdate,
} from "@/lib/services/meta/comments/types"

export const getMetaCommentAgentStatusAction = createServerAction(async () =>
  getMetaCommentAgentStatus()
)

export const getMetaCommentDashboardMetricsAction = createServerAction(
  async (range: MetaCommentDateRange) => getMetaCommentDashboardMetrics(range)
)

export const listMetaCommentActivityAction = createServerAction(
  async (input: {
    range: MetaCommentDateRange
    filter: MetaCommentActivityFilter
  }) => listMetaCommentActivity({ ...input, limit: 50 })
)

export const listMetaCommentAgentRunsAction = createServerAction(async () =>
  listMetaCommentAgentRuns(20)
)

export const getMetaCommentPageMonitoringAction = createServerAction(async () =>
  getMetaCommentPageMonitoringState()
)

export const listMetaCommentPageConfigsAction = createServerAction(async () =>
  listMetaCommentPageConfigs()
)

export const syncMetaCommentPagesAction = createServerAction(async () =>
  syncMetaCommentPageCatalog()
)

export const setMetaCommentPageEnabledAction = createServerAction(
  async (input: { pageId: string; enabled: boolean }) =>
    setMetaCommentPageEnabled(input.pageId, input.enabled)
)

export const setAllMetaCommentPagesEnabledAction = createServerAction(
  async (enabled: boolean) => setAllMetaCommentPagesEnabled(enabled)
)

export const updateMetaCommentPageReplyAction = createServerAction(
  async (input: MetaCommentPageReplyUpdate) =>
    updateMetaCommentPageReply(input)
)

export const runMetaCommentAgentNowAction = createServerAction(
  async (input: { dryRun: boolean }) =>
    runMetaCommentAgent({ trigger: "manual", dryRun: input.dryRun })
)
