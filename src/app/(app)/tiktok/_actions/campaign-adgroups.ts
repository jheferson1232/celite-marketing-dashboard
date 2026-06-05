"use server"

import { createServerAction } from "@/lib/server-action"
import { getTikTokCampaignAdGroupsByCampaignId } from "@/lib/services/tiktok/campaign-adgroups"
import { withTikTokDashboardAccount } from "@/lib/services/tiktok/tiktok-dashboard-account.server"
import type { CampaignAdSetRow, DateRange } from "@/lib/services/meta/types"

export const getTikTokCampaignAdGroups = createServerAction(
  async ({
    campaignId,
    dateRange,
    accountId,
  }: {
    campaignId: string
    dateRange: DateRange
    objective?: string
    accountId?: string
  }): Promise<CampaignAdSetRow[]> =>
    withTikTokDashboardAccount(accountId, () =>
      getTikTokCampaignAdGroupsByCampaignId(campaignId, dateRange)
    )
)
