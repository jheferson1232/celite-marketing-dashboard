"use server"

import { createServerAction } from "@/lib/server-action"
import {
  getTikTokCampaignDailyInsights,
  type TikTokCampaignDailyInsightsSummary,
} from "@/lib/services/tiktok/campaign-daily-insights"
import type { DateRange } from "@/lib/services/meta/types"

export const getTikTokCampaignDailyInsightsAction = createServerAction(
  async (input: {
    campaignId: string
    dateRange: DateRange
  }): Promise<TikTokCampaignDailyInsightsSummary> =>
    getTikTokCampaignDailyInsights(input.campaignId, input.dateRange)
)
