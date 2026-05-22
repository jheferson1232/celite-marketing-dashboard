import axios from "axios"
import type { AxiosInstance } from "axios"
import { buildDateKeys } from "@/lib/date"
import { normalizeMetaId } from "./meta-ids"
import { getPurchasesFromInsight } from "./purchase-metrics"
import { getMetaClient } from "./meta"
import { withMetaCache } from "./meta-cache"
import type { DateRange, MetaInsightRow, MetaInsightsResponse } from "./types"

const DAILY_TTL_MS = 5 * 60 * 1000

export type MetaDailyMetricCell = {
  date: string
  spend: number
  purchases: number
  saleStatus: "green" | "red" | "neutral"
}

export type MetaDailyEntityRow = {
  metaId: string
  name: string
  type: "campaign" | "adset"
  campaignMetaId?: string
  campaignName?: string
  days: MetaDailyMetricCell[]
}

function saleStatus(spend: number, purchases: number): MetaDailyMetricCell["saleStatus"] {
  if (purchases > 0) return "green"
  if (spend >= 30_000) return "red"
  return "neutral"
}

async function fetchDailyInsights(
  api: AxiosInstance,
  level: "campaign" | "adset",
  dateRange: DateRange
): Promise<MetaInsightRow[]> {
  const timeRange = JSON.stringify({
    since: dateRange.from,
    until: dateRange.to,
  })

  const fields =
    level === "campaign"
      ? "date_start,campaign_id,campaign_name,spend,actions"
      : "date_start,campaign_id,campaign_name,adset_id,adset_name,spend,actions"

  const insights: MetaInsightRow[] = []
  let response = await api.get<MetaInsightsResponse>("/insights", {
    params: {
      level,
      fields,
      time_range: timeRange,
      time_increment: 1,
      limit: 500,
    },
  })

  insights.push(...(response.data.data ?? []))

  let nextUrl = response.data.paging?.next
  while (nextUrl) {
    const nextResponse = await axios.get<MetaInsightsResponse>(nextUrl)
    insights.push(...(nextResponse.data.data ?? []))
    nextUrl = nextResponse.data.paging?.next
  }

  return insights
}

function buildCampaignRows(
  rows: MetaInsightRow[],
  dateKeys: string[]
): MetaDailyEntityRow[] {
  const byCampaign = new Map<string, MetaDailyEntityRow>()

  for (const row of rows) {
    const metaId = normalizeMetaId(row.campaign_id)
    const date = row.date_start?.slice(0, 10)
    if (!metaId || !date) continue

    let entity = byCampaign.get(metaId)
    if (!entity) {
      entity = {
        metaId,
        name: row.campaign_name || `Campaña ${metaId}`,
        type: "campaign",
        days: dateKeys.map((d) => ({
          date: d,
          spend: 0,
          purchases: 0,
          saleStatus: "neutral",
        })),
      }
      byCampaign.set(metaId, entity)
    }

    const spend = parseFloat(row.spend || "0")
    const purchases = getPurchasesFromInsight(row)
    const day = entity.days.find((d) => d.date === date)
    if (day) {
      day.spend += spend
      day.purchases += purchases
      day.saleStatus = saleStatus(day.spend, day.purchases)
    }
  }

  for (const entity of byCampaign.values()) {
    for (const day of entity.days) {
      day.saleStatus = saleStatus(day.spend, day.purchases)
    }
  }

  return [...byCampaign.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function buildAdsetRows(
  rows: MetaInsightRow[],
  dateKeys: string[]
): MetaDailyEntityRow[] {
  const byAdset = new Map<string, MetaDailyEntityRow>()

  for (const row of rows) {
    const metaId = normalizeMetaId(row.adset_id)
    const date = row.date_start?.slice(0, 10)
    if (!metaId || !date) continue

    let entity = byAdset.get(metaId)
    if (!entity) {
      entity = {
        metaId,
        name: row.adset_name || `Conjunto ${metaId}`,
        type: "adset",
        campaignMetaId: normalizeMetaId(row.campaign_id),
        campaignName: row.campaign_name,
        days: dateKeys.map((d) => ({
          date: d,
          spend: 0,
          purchases: 0,
          saleStatus: "neutral",
        })),
      }
      byAdset.set(metaId, entity)
    }

    const spend = parseFloat(row.spend || "0")
    const purchases = getPurchasesFromInsight(row)
    const day = entity.days.find((d) => d.date === date)
    if (day) {
      day.spend += spend
      day.purchases += purchases
      day.saleStatus = saleStatus(day.spend, day.purchases)
    }
  }

  for (const entity of byAdset.values()) {
    for (const day of entity.days) {
      day.saleStatus = saleStatus(day.spend, day.purchases)
    }
  }

  return [...byAdset.values()].sort((a, b) =>
    (a.campaignName || "").localeCompare(b.campaignName || "") ||
    a.name.localeCompare(b.name)
  )
}

export async function getMetaAccountDailyInsights(
  dateRange: DateRange
): Promise<{ campaigns: MetaDailyEntityRow[]; adsets: MetaDailyEntityRow[] }> {
  const cacheKey = `meta-account-daily:v1:${dateRange.from}:${dateRange.to}`
  return withMetaCache(cacheKey, DAILY_TTL_MS, async () => {
    const api = getMetaClient()
    const dateKeys = buildDateKeys(dateRange.from, dateRange.to)
    const [campaignRows, adsetRows] = await Promise.all([
      fetchDailyInsights(api, "campaign", dateRange),
      fetchDailyInsights(api, "adset", dateRange),
    ])
    return {
      campaigns: buildCampaignRows(campaignRows, dateKeys),
      adsets: buildAdsetRows(adsetRows, dateKeys),
    }
  })
}
