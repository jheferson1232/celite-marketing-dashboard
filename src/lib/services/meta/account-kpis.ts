import { buildDateKeys } from "@/lib/date"
import { getAddToCartFromActions } from "./add-to-cart"
import { getMetaClient } from "./meta"
import { metaGraphGet } from "./meta-graph-retry"
import { withMetaCache } from "./meta-cache"
import {
  getPurchaseCpaFromActions,
  getPurchasesFromActions,
} from "./purchases"
import { getPurchasesFromInsight } from "./purchase-metrics"
import type { AccountKpis, DateRange, MetaInsightRow, MetaInsightsResponse } from "./types"

const ACCOUNT_KPIS_TTL_MS = 2 * 60 * 1000

export type AccountDayKpis = {
  totalSpend: number
  purchases: number
}

export async function getAccountKpis(dateRange: DateRange): Promise<AccountKpis> {
  const cacheKey = `account-kpis:${dateRange.from}:${dateRange.to}`
  return withMetaCache(cacheKey, ACCOUNT_KPIS_TTL_MS, () =>
    fetchAccountKpis(dateRange)
  )
}

/** Gasto y compras por día en una sola consulta de insights (evita N llamadas en el informe). */
export async function getAccountKpisByDay(
  dateRange: DateRange
): Promise<Map<string, AccountDayKpis>> {
  const cacheKey = `account-kpis-by-day:v1:${dateRange.from}:${dateRange.to}`
  return withMetaCache(cacheKey, ACCOUNT_KPIS_TTL_MS, () =>
    fetchAccountKpisByDay(dateRange)
  )
}

async function fetchAccountKpisByDay(
  dateRange: DateRange
): Promise<Map<string, AccountDayKpis>> {
  const api = getMetaClient()
  const timeRange = JSON.stringify({
    since: dateRange.from,
    until: dateRange.to,
  })

  const rows: MetaInsightRow[] = []
  let response = await api.get<MetaInsightsResponse>("/insights", {
    params: {
      fields: "date_start,spend,actions",
      time_range: timeRange,
      time_increment: "1",
      limit: "500",
    },
  })

  rows.push(...(response.data.data ?? []))

  let nextUrl = response.data.paging?.next
  while (nextUrl) {
    const nextResponse = await metaGraphGet<MetaInsightsResponse>(nextUrl)
    rows.push(...(nextResponse.data ?? []))
    nextUrl = nextResponse.paging?.next
  }

  const byDay = new Map<string, AccountDayKpis>()
  for (const key of buildDateKeys(dateRange.from, dateRange.to)) {
    byDay.set(key, { totalSpend: 0, purchases: 0 })
  }

  for (const row of rows) {
    const date = row.date_start?.slice(0, 10)
    if (!date) continue
    const cell = byDay.get(date)
    if (!cell) continue
    cell.totalSpend += parseFloat(row.spend || "0")
    cell.purchases += getPurchasesFromInsight(row)
  }

  for (const cell of byDay.values()) {
    cell.purchases = Math.round(cell.purchases)
  }

  return byDay
}

async function fetchAccountKpis(dateRange: DateRange): Promise<AccountKpis> {
  const api = getMetaClient()
  const timeRange = JSON.stringify({
    since: dateRange.from,
    until: dateRange.to,
  })

  const response = await api.get<MetaInsightsResponse>("/insights", {
    params: {
      fields: "spend,impressions,clicks,ctr,cpm,actions,cost_per_action_type",
      time_range: timeRange,
    },
  })

  const data = response.data.data[0] || {
    spend: "0",
    impressions: "0",
    clicks: "0",
    ctr: "0",
    cpm: "0",
    actions: [],
    cost_per_action_type: [],
  }

  const spend = parseFloat(data.spend || "0")
  const purchases = getPurchasesFromActions(data.actions)
  const cpa = getPurchaseCpaFromActions(
    data.actions,
    data.cost_per_action_type,
    spend
  )
  const addToCart = getAddToCartFromActions(data.actions)

  return {
    totalSpend: spend,
    impressions: parseInt(data.impressions, 10),
    clicks: parseInt(data.clicks || "0", 10),
    ctr: parseFloat(data.ctr),
    cpa,
    cpm: parseFloat(data.cpm || "0"),
    purchases: Math.round(purchases),
    roas: 0,
    addToCart,
  }
}
