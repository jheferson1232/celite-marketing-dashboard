import type { DateRange } from "@/lib/services/meta/types"
import { addDaysToDateString } from "@/lib/date"
import {
  type TikTokCampaignDailyInsight,
  type TikTokCampaignDailyInsightsSummary,
} from "./campaign-daily-insights.shared"
export {
  getLastSevenDaysRange,
  type TikTokCampaignDailyInsight,
  type TikTokCampaignDailyInsightsSummary,
} from "./campaign-daily-insights.shared"
import {
  CAMPAIGN_METRICS,
  fetchIntegratedReport,
  getMetricNumber,
  getPurchases,
} from "./report"
import { convertToCopIfPen } from "@/lib/format/pen-to-cop"
import { listTikTokAdAccounts } from "./ad-accounts"
import { withTikTokCache } from "./tiktok-cache"
import { buildTikTokCacheKey } from "./tiktok-api.server"
import { withTikTokAccountForCampaign } from "./resolve-campaign-account"
import { withTikTokDashboardAccount } from "./tiktok-dashboard-account.server"
import { pacedTikTokRequest } from "./tiktok-request-pacing"

const DAILY_INSIGHTS_TTL_MS = 2 * 60 * 1000

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

function campaignReportFiltering(campaignIds: string[]): string {
  return JSON.stringify([
    {
      field_name: "campaign_ids",
      filter_type: "IN",
      filter_value: JSON.stringify(campaignIds),
    },
  ])
}

const EMPTY_DAY = {
  spend: 0,
  purchases: 0,
  cpa: 0,
  cpc: 0,
  impressions: 0,
} as const

function emptyDailySummary(
  campaignId: string,
  dateRange: DateRange
): TikTokCampaignDailyInsightsSummary {
  const days = buildDayKeys(dateRange.from, dateRange.to).map((date) => ({
    date,
    ...EMPTY_DAY,
  }))
  return {
    campaignId,
    dateRange,
    days,
    totals: { spend: 0, purchases: 0, cpa: 0 },
  }
}

function summaryFromDays(
  campaignId: string,
  dateRange: DateRange,
  byDate: Map<string, TikTokCampaignDailyInsight>
): TikTokCampaignDailyInsightsSummary {
  const days = buildDayKeys(dateRange.from, dateRange.to).map(
    (date) => byDate.get(date) ?? { date, ...EMPTY_DAY }
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

function insightFromReportMetrics(
  date: string,
  metrics: Record<string, string>
): TikTokCampaignDailyInsight {
  const spend = getMetricNumber(metrics, "spend")
  const purchases = getPurchases(metrics)
  return {
    date,
    spend,
    purchases,
    cpa: purchases > 0 ? spend / purchases : 0,
    cpc: getMetricNumber(metrics, "cpc"),
    impressions: getMetricNumber(metrics, "impressions"),
  }
}

function convertSummaryToCop(
  summary: TikTokCampaignDailyInsightsSummary,
  currency: string | null | undefined
): TikTokCampaignDailyInsightsSummary {
  const days = summary.days.map((day) => {
    const spend = convertToCopIfPen(day.spend, currency)
    const cpc = convertToCopIfPen(day.cpc, currency)
    return {
      ...day,
      spend,
      cpc,
      cpa: day.purchases > 0 ? spend / day.purchases : 0,
    }
  })
  const spend = days.reduce((sum, day) => sum + day.spend, 0)
  const purchases = days.reduce((sum, day) => sum + day.purchases, 0)
  return {
    ...summary,
    days,
    totals: {
      spend,
      purchases,
      cpa: purchases > 0 ? spend / purchases : 0,
    },
  }
}

export async function getTikTokCampaignDailyInsights(
  campaignId: string,
  dateRange: DateRange,
  accountId?: string
): Promise<TikTokCampaignDailyInsightsSummary> {
  const run = async () => {
    const cacheKey = await buildTikTokCacheKey(
      `campaign-daily:${campaignId}:${dateRange.from}:${dateRange.to}`
    )
    return withTikTokCache(cacheKey, DAILY_INSIGHTS_TTL_MS, () =>
      pacedTikTokRequest(() =>
        fetchTikTokCampaignDailyInsights(campaignId, dateRange)
      )
    )
  }

  if (accountId?.trim()) {
    return withTikTokDashboardAccount(accountId, run)
  }

  return withTikTokAccountForCampaign(campaignId, run)
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
    { filtering: campaignReportFiltering([campaignId]) }
  )

  const byDate = new Map<string, TikTokCampaignDailyInsight>()

  for (const row of rows) {
    const dayKey = parseStatTimeDay(row.dimensions.stat_time_day ?? "")
    if (!dayKey) continue
    byDate.set(dayKey, insightFromReportMetrics(dayKey, row.metrics))
  }

  return summaryFromDays(campaignId, dateRange, byDate)
}

const BATCH_FILTER_LIMIT = 100

async function fetchTikTokCampaignsDailyInsightsForAccount(
  campaignIds: string[],
  dateRange: DateRange
): Promise<Map<string, TikTokCampaignDailyInsightsSummary>> {
  const byCampaign = new Map<string, Map<string, TikTokCampaignDailyInsight>>()

  for (let i = 0; i < campaignIds.length; i += BATCH_FILTER_LIMIT) {
    const chunk = campaignIds.slice(i, i + BATCH_FILTER_LIMIT)
    const rows = await fetchIntegratedReport(
      "AUCTION_CAMPAIGN",
      ["stat_time_day", "campaign_id"],
      [...CAMPAIGN_METRICS],
      dateRange.from,
      dateRange.to,
      { filtering: campaignReportFiltering(chunk) }
    )

    for (const row of rows) {
      const campaignId = row.dimensions.campaign_id
      const dayKey = parseStatTimeDay(row.dimensions.stat_time_day ?? "")
      if (!campaignId || !dayKey) continue
      const days = byCampaign.get(campaignId) ?? new Map()
      days.set(dayKey, insightFromReportMetrics(dayKey, row.metrics))
      byCampaign.set(campaignId, days)
    }
  }

  const result = new Map<string, TikTokCampaignDailyInsightsSummary>()
  for (const [campaignId, byDate] of byCampaign) {
    result.set(campaignId, summaryFromDays(campaignId, dateRange, byDate))
  }
  return result
}

/**
 * Historial diario de varias campañas en 1 reporte por cuenta (no N llamadas).
 * Recorre cuentas activas hasta cubrir los IDs.
 */
export async function getTikTokCampaignsDailyInsightsByIds(
  campaignIds: string[],
  dateRange: DateRange
): Promise<TikTokCampaignDailyInsightsSummary[]> {
  const uniqueIds = [...new Set(campaignIds.filter(Boolean))]
  if (uniqueIds.length === 0) return []

  const cacheKey = `tiktok:linked-daily:v2-cop:${uniqueIds.toSorted().join(",")}:${dateRange.from}:${dateRange.to}`
  return withTikTokCache(cacheKey, DAILY_INSIGHTS_TTL_MS, async () => {
    const found = new Map<string, TikTokCampaignDailyInsightsSummary>()

    async function ingest(
      ids: string[]
    ): Promise<Map<string, TikTokCampaignDailyInsightsSummary>> {
      return pacedTikTokRequest(() =>
        fetchTikTokCampaignsDailyInsightsForAccount(ids, dateRange)
      )
    }

    const accounts = await listTikTokAdAccounts()
    const pending = () => uniqueIds.filter((id) => !found.has(id))

    if (accounts.length === 0) {
      const rows = await ingest(uniqueIds)
      for (const [id, summary] of rows) {
        found.set(id, convertSummaryToCop(summary, "PEN"))
      }
    } else {
      for (const account of accounts) {
        const remaining = pending()
        if (remaining.length === 0) break
        const rows = await withTikTokDashboardAccount(account.id, () =>
          ingest(remaining)
        )
        for (const [id, summary] of rows) {
          if (!found.has(id)) {
            found.set(id, convertSummaryToCop(summary, account.currency))
          }
        }
      }
    }

    return uniqueIds.map(
      (id) => found.get(id) ?? emptyDailySummary(id, dateRange)
    )
  })
}
