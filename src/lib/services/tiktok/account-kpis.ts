import type { AccountKpis, DateRange } from "@/lib/services/meta/types"
import {
  ACCOUNT_METRICS,
  aggregateReportMetrics,
  fetchIntegratedReport,
  getMetricNumber,
  getPurchases,
  getPurchaseValue,
  getRoas,
} from "./report"
import { withTikTokCache } from "./tiktok-cache"
import { buildTikTokCacheKey } from "./tiktok-api.server"

const ACCOUNT_KPIS_TTL_MS = 2 * 60 * 1000

export async function getTikTokAccountKpis(
  dateRange: DateRange
): Promise<AccountKpis> {
  const cacheKey = await buildTikTokCacheKey(
    `account-kpis:${dateRange.from}:${dateRange.to}`
  )
  return withTikTokCache(cacheKey, ACCOUNT_KPIS_TTL_MS, () =>
    fetchTikTokAccountKpis(dateRange)
  )
}

async function fetchTikTokAccountKpis(
  dateRange: DateRange
): Promise<AccountKpis> {
  const rows = await fetchIntegratedReport(
    "AUCTION_ADVERTISER",
    ["stat_time_day"],
    [...ACCOUNT_METRICS],
    dateRange.from,
    dateRange.to
  )

  const metrics = aggregateReportMetrics(rows)
  const totalSpend = getMetricNumber(metrics, "spend")
  const impressions = getMetricNumber(metrics, "impressions")
  const clicks = getMetricNumber(metrics, "clicks")
  const purchases = getPurchases(metrics)
  const cpa = purchases > 0 ? totalSpend / purchases : 0
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0
  const cpm = impressions > 0 ? (totalSpend / impressions) * 1000 : 0
  const roas =
    getRoas(metrics) ||
    (totalSpend > 0 ? getPurchaseValue(metrics) / totalSpend : 0)

  return {
    totalSpend,
    impressions,
    clicks,
    ctr,
    cpa,
    cpm,
    purchases,
    roas,
  }
}
