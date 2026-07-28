"use server"

import { createServerAction } from "@/lib/server-action"
import { getTikTokCampaignsList } from "@/lib/services/tiktok/campaigns-list"
import { backfillDashboardLaunchSourcesFromTikTokCampaigns } from "@/lib/services/tiktok/campaign-launch-source"
import { withTikTokDashboardAccount } from "@/lib/services/tiktok/tiktok-dashboard-account.server"
import type { CampaignRow, DateRange } from "@/lib/services/meta/types"

export const getTikTokCampaignsListAction = createServerAction(
  async (input: {
    dateRange: DateRange
    accountId?: string
  }): Promise<CampaignRow[]> =>
    withTikTokDashboardAccount(input.accountId, async () => {
      const rows = await getTikTokCampaignsList(input.dateRange)
      await backfillDashboardLaunchSourcesFromTikTokCampaigns(
        rows.map((row) => ({
          campaign_id: row.id,
          campaign_name: row.name,
        }))
      )
      return rows
    })
)
