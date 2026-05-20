"use server"

import { createServerAction } from "@/lib/server-action"
import {
  setTikTokCampaignStatusOnly,
  updateTikTokAdGroupBudget,
  updateTikTokAdGroupStatus,
  updateTikTokCampaignBudget,
  type TikTokOperationStatus,
} from "@/lib/services/tiktok/manage"

export const setTikTokCampaignStatusAction = createServerAction(
  async (input: {
    campaignId: string
    operationStatus: TikTokOperationStatus
  }): Promise<void> => {
    const state = await setTikTokCampaignStatusOnly(
      input.campaignId,
      input.operationStatus
    )
    if (state.campaignOperationStatus !== input.operationStatus) {
      throw new Error(
        `No se pudo actualizar la campaña en TikTok (estado: ${state.campaignOperationStatus})`
      )
    }
  }
)

export const setTikTokAdGroupStatusAction = createServerAction(
  async (input: {
    adgroupId: string
    operationStatus: TikTokOperationStatus
  }): Promise<void> => {
    await updateTikTokAdGroupStatus([input.adgroupId], input.operationStatus)
  }
)

export const setTikTokCampaignBudgetAction = createServerAction(
  async (input: { campaignId: string; budget: number }): Promise<void> => {
    await updateTikTokCampaignBudget(input.campaignId, input.budget)
  }
)

export const setTikTokAdGroupBudgetAction = createServerAction(
  async (input: { adgroupId: string; budget: number }): Promise<void> => {
    await updateTikTokAdGroupBudget(input.adgroupId, input.budget)
  }
)
