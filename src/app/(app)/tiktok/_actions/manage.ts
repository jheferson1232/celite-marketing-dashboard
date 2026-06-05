"use server"

import { createServerAction } from "@/lib/server-action"
import {
  setTikTokCampaignStatusOnly,
  updateTikTokAdGroupBudget,
  updateTikTokAdGroupStatus,
  updateTikTokCampaignBudget,
  type TikTokOperationStatus,
} from "@/lib/services/tiktok/manage"
import { withTikTokDashboardAccount } from "@/lib/services/tiktok/tiktok-dashboard-account.server"

export const setTikTokCampaignStatusAction = createServerAction(
  async (input: {
    campaignId: string
    operationStatus: TikTokOperationStatus
    accountId?: string
  }): Promise<void> =>
    withTikTokDashboardAccount(input.accountId, async () => {
      const state = await setTikTokCampaignStatusOnly(
        input.campaignId,
        input.operationStatus
      )
      if (state.campaignOperationStatus !== input.operationStatus) {
        throw new Error(
          `No se pudo actualizar la campaña en TikTok (estado: ${state.campaignOperationStatus})`
        )
      }
    })
)

export const setTikTokAdGroupStatusAction = createServerAction(
  async (input: {
    adgroupId: string
    operationStatus: TikTokOperationStatus
    accountId?: string
  }): Promise<void> =>
    withTikTokDashboardAccount(input.accountId, () =>
      updateTikTokAdGroupStatus([input.adgroupId], input.operationStatus)
    )
)

export const setTikTokCampaignBudgetAction = createServerAction(
  async (input: {
    campaignId: string
    budget: number
    accountId?: string
  }): Promise<void> =>
    withTikTokDashboardAccount(input.accountId, () =>
      updateTikTokCampaignBudget(input.campaignId, input.budget)
    )
)

export const setTikTokAdGroupBudgetAction = createServerAction(
  async (input: {
    adgroupId: string
    budget: number
    accountId?: string
  }): Promise<void> =>
    withTikTokDashboardAccount(input.accountId, () =>
      updateTikTokAdGroupBudget(input.adgroupId, input.budget)
    )
)
