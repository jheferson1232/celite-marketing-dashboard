import type { MetaApiClient } from "./meta"
import { metaGraphGet } from "./meta-graph-retry"
import { normalizeMetaId } from "./meta-ids"
import type { DateRange, MetaInsightRow, MetaInsightsResponse } from "./types"

const CAMPAIGN_INSIGHT_FIELDS =
  "campaign_name,campaign_id,objective,spend,impressions,ctr,cpc,actions,cost_per_action_type,action_values"

/** Insights a nivel campaña con paginación completa. */
export async function fetchAllCampaignInsights(
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
      level: "campaign",
      fields: CAMPAIGN_INSIGHT_FIELDS,
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

/** Insights solo de las campañas pedidas (filtro IN). */
export async function fetchCampaignInsightsByIds(
  api: MetaApiClient,
  dateRange: DateRange,
  campaignIds: string[]
): Promise<MetaInsightRow[]> {
  const ids = [...new Set(campaignIds.map(normalizeMetaId).filter(Boolean))]
  if (ids.length === 0) return []

  const timeRange = JSON.stringify({
    since: dateRange.from,
    until: dateRange.to,
  })
  const filtering = JSON.stringify([
    {
      field: "campaign.id",
      operator: "IN",
      value: ids,
    },
  ])

  const insights: MetaInsightRow[] = []
  let response = await api.get<MetaInsightsResponse>("/insights", {
    params: {
      level: "campaign",
      fields: CAMPAIGN_INSIGHT_FIELDS,
      time_range: timeRange,
      filtering,
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

export function campaignInsightsToMap(
  rows: MetaInsightRow[]
): Map<string, MetaInsightRow> {
  const map = new Map<string, MetaInsightRow>()
  for (const row of rows) {
    const id = normalizeMetaId(row.campaign_id)
    if (id) map.set(id, row)
  }
  return map
}
