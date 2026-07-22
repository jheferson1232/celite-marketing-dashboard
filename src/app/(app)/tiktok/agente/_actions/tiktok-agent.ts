"use server"

import { createServerAction } from "@/lib/server-action"
import {
  getTikTokAgentThresholds,
  saveTikTokAgentThresholds,
} from "@/lib/services/tiktok/agent/config"
import {
  getTikTokAgentRun,
  listTikTokAgentRuns,
  runTikTokAgent,
} from "@/lib/services/tiktok/agent/runner"
import { listTikTokPausedRecoverable } from "@/lib/services/tiktok/agent/paused-recoverable"
import {
  archiveRecoverableCampaign,
  listArchivedRecoverableCampaigns,
  unarchiveRecoverableCampaign,
} from "@/lib/services/tiktok/agent/archived-recoverable"
import { getTikTokAgentTelegramStatus } from "@/lib/services/tiktok/agent/telegram"
import type { TikTokAgentThresholds } from "@/lib/services/tiktok/agent/types"

export const getTikTokAgentThresholdsAction = createServerAction(async () =>
  getTikTokAgentThresholds()
)

export const saveTikTokAgentThresholdsAction = createServerAction(
  async (input: Partial<TikTokAgentThresholds>) =>
    saveTikTokAgentThresholds(input)
)

export const getTikTokAgentTelegramStatusAction = createServerAction(async () =>
  getTikTokAgentTelegramStatus()
)

export const listTikTokAgentRunsAction = createServerAction(async () =>
  listTikTokAgentRuns(20)
)

export const getTikTokAgentRunAction = createServerAction(async (runId: string) =>
  getTikTokAgentRun(runId)
)

export const runTikTokAgentNowAction = createServerAction(
  async (input: { dryRun: boolean }) =>
    runTikTokAgent({ trigger: "manual", dryRun: input.dryRun })
)

export const listTikTokPausedRecoverableAction = createServerAction(async () =>
  listTikTokPausedRecoverable()
)

export const listArchivedRecoverableCampaignsAction = createServerAction(
  async () => listArchivedRecoverableCampaigns()
)

export const archiveRecoverableCampaignAction = createServerAction(
  async (input: { campaignId: string; name: string }) =>
    archiveRecoverableCampaign(input)
)

export const unarchiveRecoverableCampaignAction = createServerAction(
  async (campaignId: string) => unarchiveRecoverableCampaign(campaignId)
)
