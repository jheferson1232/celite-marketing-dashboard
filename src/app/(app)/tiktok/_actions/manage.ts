"use server"

import { createServerAction } from "@/lib/server-action"
import { applyTikTokCampaignStatusWith6amQueue } from "@/lib/services/tiktok/apply-campaign-status-6am"
import { duplicateTikTokAdGroup } from "@/lib/services/tiktok/duplicate-adgroup"
import {
  updateTikTokAdGroupBudget,
  updateTikTokAdGroupStatus,
  updateTikTokCampaignBudget,
  type TikTokOperationStatus,
} from "@/lib/services/tiktok/manage"
import { withTikTokAccountForAdGroup, withTikTokAccountForCampaign } from "@/lib/services/tiktok/resolve-campaign-account"
import { withTikTokDashboardAccount } from "@/lib/services/tiktok/tiktok-dashboard-account.server"

function withTikTokAccountForAdGroupAction<T>(
  input: { accountId?: string; campaignId?: string; adgroupId: string },
  fn: () => Promise<T>
): Promise<T> {
  if (input.accountId?.trim()) {
    return withTikTokDashboardAccount(input.accountId, fn)
  }
  if (input.campaignId?.trim()) {
    return withTikTokAccountForCampaign(input.campaignId, fn)
  }
  return withTikTokAccountForAdGroup(input.adgroupId, fn)
}

export const setTikTokCampaignStatusAction = createServerAction(
  async (input: {
    campaignId: string
    operationStatus: TikTokOperationStatus
    campaignName?: string
    accountId?: string
  }) => {
    const run = () =>
      applyTikTokCampaignStatusWith6amQueue({
        campaignId: input.campaignId,
        name: input.campaignName,
        operationStatus: input.operationStatus,
      })

    if (input.accountId?.trim()) {
      return withTikTokDashboardAccount(input.accountId, run)
    }

    return withTikTokAccountForCampaign(input.campaignId, run)
  }
)

export const setTikTokAdGroupStatusAction = createServerAction(
  async (input: {
    adgroupId: string
    operationStatus: TikTokOperationStatus
    accountId?: string
    campaignId?: string
  }): Promise<void> =>
    withTikTokAccountForAdGroupAction(input, () =>
      updateTikTokAdGroupStatus([input.adgroupId], input.operationStatus)
    )
)

export const setTikTokCampaignBudgetAction = createServerAction(
  async (input: {
    campaignId: string
    budget: number
    accountId?: string
  }): Promise<void> => {
    const run = () => updateTikTokCampaignBudget(input.campaignId, input.budget)
    if (input.accountId?.trim()) {
      return withTikTokDashboardAccount(input.accountId, run)
    }
    return withTikTokAccountForCampaign(input.campaignId, run)
  }
)

export const setTikTokAdGroupBudgetAction = createServerAction(
  async (input: {
    adgroupId: string
    budget: number
    accountId?: string
    campaignId?: string
  }): Promise<void> =>
    withTikTokAccountForAdGroupAction(input, () =>
      updateTikTokAdGroupBudget(input.adgroupId, input.budget)
    )
)

export const duplicateTikTokAdGroupAction = createServerAction(
  async (input: {
    adgroupId: string
    accountId?: string
    campaignId?: string
  }) =>
    withTikTokAccountForAdGroupAction(input, () =>
      duplicateTikTokAdGroup(input.adgroupId)
    )
)
