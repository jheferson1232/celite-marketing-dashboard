"use server"

import { createServerAction } from "@/lib/server-action"
import { getTikTokCampaignsList } from "@/lib/services/tiktok/campaigns-list"
import { withTikTokDashboardAccount } from "@/lib/services/tiktok/tiktok-dashboard-account.server"
import type { CampaignRow, DateRange } from "@/lib/services/meta/types"

export const getTikTokCampaignsListAction = createServerAction(
  async (input: { dateRange: DateRange; accountId?: string }): Promise<CampaignRow[]> =>
    withTikTokDashboardAccount(input.accountId, () =>
      getTikTokCampaignsList(input.dateRange)
    )
)
