import type { AccountKpis, DateRange } from "@/lib/services/meta/types"
import { listTikTokAdAccounts } from "./ad-accounts"
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
import { withTikTokDashboardAccount } from "./tiktok-dashboard-account.server"

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

/** KPIs sumados de todas las cuentas TikTok activas (Resumen / totales globales). */
export async function getTikTokAllAccountsKpis(
  dateRange: DateRange
): Promise<AccountKpis> {
  const cacheKey = `tiktok:all-accounts:account-kpis:${dateRange.from}:${dateRange.to}`
  return withTikTokCache(cacheKey, ACCOUNT_KPIS_TTL_MS, () =>
    fetchTikTokAllAccountsKpis(dateRange)
  )
}

function mergeAccountKpis(parts: AccountKpis[]): AccountKpis {
  let totalSpend = 0
  let impressions = 0
  let clicks = 0
  let purchases = 0
  let addToCart = 0
  let purchaseValue = 0

  for (const part of parts) {
    totalSpend += part.totalSpend
    impressions += part.impressions
    clicks += part.clicks
    purchases += part.purchases
    addToCart += part.addToCart ?? 0
    purchaseValue += part.roas * part.totalSpend
  }

  return {
    totalSpend,
    impressions,
    clicks,
    purchases,
    addToCart: addToCart > 0 ? addToCart : undefined,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpa: purchases > 0 ? totalSpend / purchases : 0,
    cpm: impressions > 0 ? (totalSpend / impressions) * 1000 : 0,
    roas: totalSpend > 0 ? purchaseValue / totalSpend : 0,
  }
}

async function fetchTikTokAllAccountsKpis(
  dateRange: DateRange
): Promise<AccountKpis> {
  const accounts = await listTikTokAdAccounts()

  if (accounts.length === 0) {
    return getTikTokAccountKpis(dateRange)
  }

  if (accounts.length === 1) {
    return withTikTokDashboardAccount(accounts[0].id, () =>
      getTikTokAccountKpis(dateRange)
    )
  }

  const results = await Promise.all(
    accounts.map(async (account) => {
      try {
        return await withTikTokDashboardAccount(account.id, () =>
          getTikTokAccountKpis(dateRange)
        )
      } catch (error) {
        console.warn(
          `[tiktok] No se pudieron obtener KPIs de ${account.advertiserId} (${account.name}):`,
          error
        )
        return null
      }
    })
  )

  const succeeded = results.filter((r): r is AccountKpis => r !== null)
  if (succeeded.length === 0) {
    throw new Error("No se pudo obtener KPIs de ninguna cuenta TikTok")
  }

  return mergeAccountKpis(succeeded)
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
