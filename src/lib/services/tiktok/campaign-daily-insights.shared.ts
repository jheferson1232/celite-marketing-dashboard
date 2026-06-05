import type { DateRange } from "@/lib/services/meta/types"
import { addDaysToDateString, getDashboardToday } from "@/lib/date"

export interface TikTokCampaignDailyInsight {
  date: string
  spend: number
  purchases: number
  cpa: number
  cpc: number
  impressions: number
}

export interface TikTokCampaignDailyInsightsSummary {
  campaignId: string
  dateRange: DateRange
  days: TikTokCampaignDailyInsight[]
  totals: {
    spend: number
    purchases: number
    cpa: number
  }
}

export function getLastSevenDaysRange(): DateRange {
  const to = getDashboardToday()
  const from = addDaysToDateString(to, -6)
  return { from, to }
}
