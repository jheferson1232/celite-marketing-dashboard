import { getMetaClient } from "./meta"
import { withMetaCache } from "./meta-cache"
import {
  getPurchaseCpaFromActions,
  getPurchasesFromActions,
} from "./purchases"
import type { AccountKpis, DateRange, MetaInsightsResponse } from "./types"

const ACCOUNT_KPIS_TTL_MS = 2 * 60 * 1000

export async function getAccountKpis(dateRange: DateRange): Promise<AccountKpis> {
  const cacheKey = `account-kpis:${dateRange.from}:${dateRange.to}`
  return withMetaCache(cacheKey, ACCOUNT_KPIS_TTL_MS, () =>
    fetchAccountKpis(dateRange)
  )
}

async function fetchAccountKpis(dateRange: DateRange): Promise<AccountKpis> {
  const api = getMetaClient()
  const timeRange = JSON.stringify({
    since: dateRange.from,
    until: dateRange.to,
  })

  const response = await api.get<MetaInsightsResponse>("/insights", {
    params: {
      fields:
        "spend,impressions,clicks,ctr,cpm,actions,cost_per_action_type,purchase_roas",
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
    purchase_roas: [],
  }

  const spend = parseFloat(data.spend || "0")
  const purchases = getPurchasesFromActions(data.actions)
  const cpa = getPurchaseCpaFromActions(
    data.actions,
    data.cost_per_action_type,
    spend
  )
  const roas = data.purchase_roas?.[0]?.value || "0"

  return {
    totalSpend: spend,
    impressions: parseInt(data.impressions, 10),
    clicks: parseInt(data.clicks || "0", 10),
    ctr: parseFloat(data.ctr),
    cpa,
    cpm: parseFloat(data.cpm || "0"),
    purchases: Math.round(purchases),
    roas: parseFloat(roas),
  }
}
