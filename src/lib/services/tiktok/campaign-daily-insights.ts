import type { DateRange } from "@/lib/services/meta/types"
import { addDaysToDateString, getDashboardToday } from "@/lib/date"
import {
  CAMPAIGN_METRICS,
  fetchIntegratedReport,
  getMetricNumber,
  getPurchases,
} from "./report"
import { withTikTokCache } from "./tiktok-cache"

const DAILY_INSIGHTS_TTL_MS = 2 * 60 * 1000

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

function parseStatTimeDay(value: string): string {
  return value.slice(0, 10)
}

function buildDayKeys(from: string, to: string): string[] {
  const keys: string[] = []
  let cursor = from
  while (cursor <= to) {
    keys.push(cursor)
    cursor = addDaysToDateString(cursor, 1)
  }
  return keys
}

function campaignReportFiltering(campaignId: string): string {
  return JSON.stringify([
    {
      field_name: "campaign_ids",
      filter_type: "IN",
      filter_value: JSON.stringify([campaignId]),
    },
  ])
}

export async function getTikTokCampaignDailyInsights(
  campaignId: string,
  dateRange: DateRange
): Promise<TikTokCampaignDailyInsightsSummary> {
  const cacheKey = `tiktok-campaign-daily:${campaignId}:${dateRange.from}:${dateRange.to}`
  return withTikTokCache(cacheKey, DAILY_INSIGHTS_TTL_MS, () =>
    fetchTikTokCampaignDailyInsights(campaignId, dateRange)
  )
}

async function fetchTikTokCampaignDailyInsights(
  campaignId: string,
  dateRange: DateRange
): Promise<TikTokCampaignDailyInsightsSummary> {
  const rows = await fetchIntegratedReport(
    "AUCTION_CAMPAIGN",
    ["stat_time_day"],
    [...CAMPAIGN_METRICS],
    dateRange.from,
    dateRange.to,
    { filtering: campaignReportFiltering(campaignId) }
  )

  const byDate = new Map<string, TikTokCampaignDailyInsight>()

  for (const row of rows) {
    const dayKey = parseStatTimeDay(row.dimensions.stat_time_day ?? "")
    if (!dayKey) continue

    const spend = getMetricNumber(row.metrics, "spend")
    const purchases = getPurchases(row.metrics)
    byDate.set(dayKey, {
      date: dayKey,
      spend,
      purchases,
      cpa: purchases > 0 ? spend / purchases : 0,
      cpc: getMetricNumber(row.metrics, "cpc"),
      impressions: getMetricNumber(row.metrics, "impressions"),
    })
  }

  const days = buildDayKeys(dateRange.from, dateRange.to).map(
    (date) =>
      byDate.get(date) ?? {
        date,
        spend: 0,
        purchases: 0,
        cpa: 0,
        cpc: 0,
        impressions: 0,
      }
  )

  const totalSpend = days.reduce((sum, d) => sum + d.spend, 0)
  const totalPurchases = days.reduce((sum, d) => sum + d.purchases, 0)

  return {
    campaignId,
    dateRange,
    days,
    totals: {
      spend: totalSpend,
      purchases: totalPurchases,
      cpa: totalPurchases > 0 ? totalSpend / totalPurchases : 0,
    },
  }
}
