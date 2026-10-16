"use server"

import { createServerAction } from "@/lib/server-action"
import {
  getMetaCampaignDailyInsights,
  type MetaCampaignDailyInsightsSummary,
} from "@/lib/services/meta/campaign-daily-insights"
import { withMetaDashboardAccount } from "@/lib/services/meta/meta-dashboard-account.server"
import type { DateRange } from "@/lib/services/meta/types"

export const getMetaCampaignDailyInsightsAction = createServerAction(
  async (input: {
    campaignId: string
    dateRange: DateRange
    objective: string
    accountId?: string
  }): Promise<MetaCampaignDailyInsightsSummary> =>
    withMetaDashboardAccount(input.accountId, () =>
      getMetaCampaignDailyInsights(
        input.campaignId,
        input.dateRange,
        input.objective
      )
    )
)
