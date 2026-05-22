import type { MetaApiClient } from "./meta"
import { metaGraphGet } from "./meta-graph-retry"
import { addDaysToDateString, getDashboardToday } from "@/lib/date"
import { normalizeMetaId } from "./meta-ids"
import { withMetaCache } from "./meta-cache"
import type { DateRange, MetaInsightRow, MetaInsightsResponse } from "./types"

export function getAdsetLastSevenDaysRange(): DateRange {
  const to = getDashboardToday()
  return { from: addDaysToDateString(to, -6), to }
}

export function getAdsetLifetimeDateRange(): DateRange {
  const to = getDashboardToday()
  return { from: addDaysToDateString(to, -364), to }
}

const ADSET_INSIGHT_FIELDS =
  "campaign_id,adset_id,adset_name,spend,impressions,ctr,cpc,actions,cost_per_action_type,action_values"

const ADSET_INSIGHTS_TTL_MS = 5 * 60 * 1000

/** Insights a nivel conjunto (una sola paginación cacheada por periodo). */
export async function fetchAllAdsetInsights(
  api: MetaApiClient,
  dateRange: DateRange
): Promise<MetaInsightRow[]> {
  const timeRange = JSON.stringify({
    since: dateRange.from,
    until: dateRange.to,
  })

  const insights: MetaInsightRow[] = []
  let response = await api.get<MetaInsightsResponse>("/insights", {
    params: {
      level: "adset",
      fields: ADSET_INSIGHT_FIELDS,
      time_range: timeRange,
      limit: "500",
    },
  })

  insights.push(...(response.data.data ?? []))

  let nextUrl = response.data.paging?.next
  while (nextUrl) {
    const nextResponse = await metaGraphGet<MetaInsightsResponse>(nextUrl)
    insights.push(...(nextResponse.data ?? []))
    nextUrl = nextResponse.paging?.next
  }

  return insights
}

export function adsetInsightsByCampaignId(
  rows: MetaInsightRow[],
  campaignId: string
): MetaInsightRow[] {
  const normalizedCampaignId = normalizeMetaId(campaignId)
  return rows.filter(
    (row) => normalizeMetaId(row.campaign_id) === normalizedCampaignId
  )
}

export function adsetInsightsToMapByAdSetId(
  rows: MetaInsightRow[]
): Map<string, MetaInsightRow> {
  const map = new Map<string, MetaInsightRow>()
  for (const row of rows) {
    const id = normalizeMetaId(row.adset_id)
    if (id) map.set(id, row)
  }
  return map
}

export async function getCachedMetaAdsetInsights(
  api: MetaApiClient,
  dateRange: DateRange
): Promise<MetaInsightRow[]> {
  const cacheKey = `meta:adset-insights:${dateRange.from}:${dateRange.to}`
  return withMetaCache(cacheKey, ADSET_INSIGHTS_TTL_MS, () =>
    fetchAllAdsetInsights(api, dateRange)
  )
}
