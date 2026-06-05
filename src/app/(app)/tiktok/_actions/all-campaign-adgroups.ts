"use server"

import { createServerAction } from "@/lib/server-action"
import type { DateRange } from "@/lib/services/meta/types"
import { getTikTokAdSetsGroupedByCampaign } from "@/lib/services/tiktok/campaign-adgroups"
import { withTikTokDashboardAccount } from "@/lib/services/tiktok/tiktok-dashboard-account.server"

export const getTikTokAllCampaignAdGroupsAction = createServerAction(
  async (input: { dateRange: DateRange; accountId?: string }) =>
    withTikTokDashboardAccount(input.accountId, () =>
      getTikTokAdSetsGroupedByCampaign(input.dateRange)
    )
)
