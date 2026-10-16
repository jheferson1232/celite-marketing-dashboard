"use server"

import { createServerAction } from "@/lib/server-action"
import { getCampaignAdSetsByCampaignId } from "@/lib/services/meta/campaign-adsets"
import { withMetaDashboardAccount } from "@/lib/services/meta/meta-dashboard-account.server"
import type { CampaignAdSetRow, DateRange } from "@/lib/services/meta/types"

export const getCampaignAdSets = createServerAction(
  async ({
    campaignId,
    dateRange,
    objective,
    accountId,
  }: {
    campaignId: string
    dateRange: DateRange
    objective: string
    accountId?: string
  }): Promise<CampaignAdSetRow[]> =>
    withMetaDashboardAccount(accountId, () =>
      getCampaignAdSetsByCampaignId(campaignId, dateRange, objective)
    )
)
