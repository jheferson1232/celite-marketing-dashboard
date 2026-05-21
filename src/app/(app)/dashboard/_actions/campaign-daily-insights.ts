"use server"

import { createServerAction } from "@/lib/server-action"
import {
  getMetaCampaignDailyInsights,
  type MetaCampaignDailyInsightsSummary,
} from "@/lib/services/meta/campaign-daily-insights"
import type { DateRange } from "@/lib/services/meta/types"

export const getMetaCampaignDailyInsightsAction = createServerAction(
  async (input: {
    campaignId: string
    dateRange: DateRange
    objective: string
  }): Promise<MetaCampaignDailyInsightsSummary> =>
    getMetaCampaignDailyInsights(
      input.campaignId,
      input.dateRange,
      input.objective
    )
)
