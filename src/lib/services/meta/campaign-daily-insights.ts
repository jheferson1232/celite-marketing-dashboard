import { addDaysToDateString, getDashboardToday } from "@/lib/date"
import { OBJECTIVE_TO_ACTION_TYPE } from "./objective"
import { getMetaClient } from "./meta"
import { withMetaCache } from "./meta-cache"
import {
  isMetaRateLimitAxiosError,
  isMetaRateLimitMessage,
} from "./meta-errors"
import { pacedMetaRequest } from "./meta-request-pacing"
import type { DateRange, MetaInsightRow, MetaInsightsResponse } from "./types"

const DAILY_INSIGHTS_TTL_MS = 2 * 60 * 1000
const MAX_RETRIES = 4
const RETRY_DELAY_MS = 1_500

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface MetaCampaignDailyInsight {
  date: string
  spend: number
  purchases: number
  cpa: number
}

export interface MetaCampaignDailyInsightsSummary {
  campaignId: string
  dateRange: DateRange
  days: MetaCampaignDailyInsight[]
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

function buildDayKeys(from: string, to: string): string[] {
  const keys: string[] = []
  let cursor = from
  while (cursor <= to) {
    keys.push(cursor)
    cursor = addDaysToDateString(cursor, 1)
  }
  return keys
}

function getPurchases(insight: MetaInsightRow, objective: string): number {
  const actionType = OBJECTIVE_TO_ACTION_TYPE[objective] || "omni_purchase"
  const raw =
    insight.actions?.find((action) => action.action_type === actionType)
      ?.value ?? "0"
  return parseInt(raw, 10) || 0
}

export async function getMetaCampaignDailyInsights(
  campaignId: string,
  dateRange: DateRange,
  objective: string
): Promise<MetaCampaignDailyInsightsSummary> {
  const cacheKey = `meta-campaign-daily:${campaignId}:${dateRange.from}:${dateRange.to}:${objective}`
  return withMetaCache(cacheKey, DAILY_INSIGHTS_TTL_MS, () =>
    pacedMetaRequest(() =>
      fetchMetaCampaignDailyInsightsWithRetry(campaignId, dateRange, objective)
    )
  )
}

async function fetchMetaCampaignDailyInsightsWithRetry(
  campaignId: string,
  dateRange: DateRange,
  objective: string
): Promise<MetaCampaignDailyInsightsSummary> {
  let lastError: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fetchMetaCampaignDailyInsights(
        campaignId,
        dateRange,
        objective
      )
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : ""
      const rateLimited =
        isMetaRateLimitAxiosError(error) || isMetaRateLimitMessage(message)
      if (!rateLimited || attempt >= MAX_RETRIES) throw error
      await sleep(RETRY_DELAY_MS * (attempt + 1))
    }
  }
  throw lastError
}

async function fetchMetaCampaignDailyInsights(
  campaignId: string,
  dateRange: DateRange,
  objective: string
): Promise<MetaCampaignDailyInsightsSummary> {
  const api = getMetaClient()
  const timeRange = JSON.stringify({
    since: dateRange.from,
    until: dateRange.to,
  })
  const campaignFilter = JSON.stringify([
    {
      field: "campaign.id",
      operator: "EQUAL",
      value: campaignId,
    },
  ])

  const insightsRes = await api.get<MetaInsightsResponse>("/insights", {
    params: {
      level: "campaign",
      fields: "date_start,spend,actions",
      filtering: campaignFilter,
      time_range: timeRange,
      time_increment: "1",
      limit: "500",
    },
  })

  const byDate = new Map<string, MetaCampaignDailyInsight>()

  for (const row of insightsRes.data.data) {
    const dayKey = row.date_start?.slice(0, 10)
    if (!dayKey) continue

    const spend = parseFloat(row.spend || "0")
    const purchases = getPurchases(row, objective)
    byDate.set(dayKey, {
      date: dayKey,
      spend,
      purchases,
      cpa: purchases > 0 ? spend / purchases : 0,
    })
  }

  const days = buildDayKeys(dateRange.from, dateRange.to).map(
    (date) =>
      byDate.get(date) ?? {
        date,
        spend: 0,
        purchases: 0,
        cpa: 0,
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
