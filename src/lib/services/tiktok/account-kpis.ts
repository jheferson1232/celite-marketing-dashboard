import { convertPenToCop } from "@/lib/format/pen-to-cop"
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
/** TikTok QPS es bajo; muchas cuentas en paralelo pierden cuentas (gasto incompleto). */
const ACCOUNT_FETCH_CONCURRENCY = 2
const ACCOUNT_FETCH_RETRIES = 3

export type TikTokAggregatedAccountKpis = {
  /** Suma de gasto en cuentas PEN (soles). */
  spendPen: number
  /** Suma de gasto en cuentas COP (pesos), sin conversión. */
  spendCopNative: number
  /** Total en COP: nativo COP + PEN convertido. */
  spendCop: number
  purchases: number
  /** CPA en PEN sobre el gasto PEN (tarjeta Resumen TikTok). */
  cpaPen: number
  impressions: number
  clicks: number
  ctr: number
  cpm: number
  roas: number
  accountsSucceeded: number
  accountsFailed: number
}

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
): Promise<TikTokAggregatedAccountKpis> {
  const cacheKey = `tiktok:all-accounts:account-kpis:v2:${dateRange.from}:${dateRange.to}`
  return withTikTokCache(cacheKey, ACCOUNT_KPIS_TTL_MS, () =>
    fetchTikTokAllAccountsKpis(dateRange)
  )
}

function isLikelyTikTokQpsError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.toLowerCase().includes("qps")
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function emptyAggregated(): TikTokAggregatedAccountKpis {
  return {
    spendPen: 0,
    spendCopNative: 0,
    spendCop: 0,
    purchases: 0,
    cpaPen: 0,
    impressions: 0,
    clicks: 0,
    ctr: 0,
    cpm: 0,
    roas: 0,
    accountsSucceeded: 0,
    accountsFailed: 0,
  }
}

function isPenCurrency(currency: string | null | undefined): boolean {
  return (currency ?? "PEN").trim().toUpperCase() === "PEN"
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return []
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(items[index])
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  )
  await Promise.all(workers)
  return results
}

async function fetchAccountKpisWithRetry(
  accountId: string,
  dateRange: DateRange
): Promise<AccountKpis> {
  let lastError: unknown
  for (let attempt = 0; attempt <= ACCOUNT_FETCH_RETRIES; attempt++) {
    try {
      return await withTikTokDashboardAccount(accountId, () =>
        fetchTikTokAccountKpis(dateRange)
      )
    } catch (error) {
      lastError = error
      if (
        attempt < ACCOUNT_FETCH_RETRIES &&
        isLikelyTikTokQpsError(error)
      ) {
        await sleep(400 * (attempt + 1))
        continue
      }
      throw error
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("No se pudo obtener KPIs de TikTok")
}

async function fetchTikTokAllAccountsKpis(
  dateRange: DateRange
): Promise<TikTokAggregatedAccountKpis> {
  const accounts = await listTikTokAdAccounts()

  if (accounts.length === 0) {
    const single = await getTikTokAccountKpis(dateRange)
    const spendPen = single.totalSpend
    return {
      spendPen,
      spendCopNative: 0,
      spendCop: convertPenToCop(spendPen),
      purchases: single.purchases,
      cpaPen: single.cpa,
      impressions: single.impressions,
      clicks: single.clicks,
      ctr: single.ctr,
      cpm: single.cpm,
      roas: single.roas,
      accountsSucceeded: 1,
      accountsFailed: 0,
    }
  }

  const results = await mapPool(
    accounts,
    ACCOUNT_FETCH_CONCURRENCY,
    async (account) => {
      try {
        const kpis = await fetchAccountKpisWithRetry(account.id, dateRange)
        return { account, kpis, error: null as string | null }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.warn(
          `[tiktok] No se pudieron obtener KPIs de ${account.advertiserId} (${account.name}):`,
          message
        )
        return { account, kpis: null, error: message }
      }
    }
  )

  const aggregated = emptyAggregated()
  let purchaseValuePen = 0

  for (const result of results) {
    if (!result.kpis) {
      aggregated.accountsFailed += 1
      continue
    }
    aggregated.accountsSucceeded += 1
    const { kpis, account } = result
    aggregated.purchases += kpis.purchases
    aggregated.impressions += kpis.impressions
    aggregated.clicks += kpis.clicks

    if (isPenCurrency(account.currency)) {
      aggregated.spendPen += kpis.totalSpend
      purchaseValuePen += kpis.roas * kpis.totalSpend
    } else {
      aggregated.spendCopNative += kpis.totalSpend
    }
  }

  if (aggregated.accountsSucceeded === 0) {
    throw new Error("No se pudo obtener KPIs de ninguna cuenta TikTok")
  }

  aggregated.spendCop =
    aggregated.spendCopNative + convertPenToCop(aggregated.spendPen)
  aggregated.cpaPen =
    aggregated.purchases > 0 && aggregated.spendPen > 0
      ? aggregated.spendPen / aggregated.purchases
      : 0
  aggregated.ctr =
    aggregated.impressions > 0
      ? (aggregated.clicks / aggregated.impressions) * 100
      : 0
  aggregated.cpm =
    aggregated.impressions > 0
      ? (aggregated.spendPen / aggregated.impressions) * 1000
      : 0
  aggregated.roas =
    aggregated.spendPen > 0 ? purchaseValuePen / aggregated.spendPen : 0

  if (aggregated.accountsFailed > 0) {
    console.warn(
      `[tiktok] KPIs incompletos: ${aggregated.accountsSucceeded} ok, ${aggregated.accountsFailed} fallaron`
    )
  }

  return aggregated
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
