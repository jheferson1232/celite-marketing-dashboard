import { getPenToCopRate } from "@/lib/format/pen-to-cop"
import { getAccountKpis } from "@/lib/services/meta/account-kpis"
import { withMetaCache } from "@/lib/services/meta/meta-cache"
import type { DateRange } from "@/lib/services/meta/types"
import { getTikTokAllAccountsKpis } from "@/lib/services/tiktok/account-kpis"
import {
  getPreviousDateRange,
  percentChange,
} from "./date-range"
import { computeBlendedCpaCop, safeNum } from "./safe-number"

const SUMMARY_TTL_MS = 2 * 60 * 1000

export interface SummaryPlatformBlock {
  spendCop: number
  purchases: number
  purchasesChangePct: number | null
  /** CPA en COP. TikTok: COP nativo o PEN convertido. */
  cpa: number
  spendChangePct: number | null
  cpaChangePct: number | null
}

export interface SummaryKpis {
  dateRange: DateRange
  penToCopRate: number
  meta: SummaryPlatformBlock
  tiktok: SummaryPlatformBlock & { spendPen: number; cpaPen: number }
  total: {
    spendCop: number
    spendChangePct: number | null
    purchases: number
    purchasesChangePct: number | null
    /** Gasto total COP / pedidos totales (TikTok incluido convertido a COP). */
    cpaCop: number
    cpaChangePct: number | null
  }
}

async function fetchSummaryKpis(dateRange: DateRange): Promise<SummaryKpis> {
  const previousRange = getPreviousDateRange(dateRange)
  const penToCopRate = getPenToCopRate()

  const [metaCurrent, metaPrevious, tiktokCurrent, tiktokPrevious] =
    await Promise.all([
      getAccountKpis(dateRange),
      getAccountKpis(previousRange),
      getTikTokAllAccountsKpis(dateRange),
      getTikTokAllAccountsKpis(previousRange),
    ])

  const metaSpendCop = safeNum(metaCurrent.totalSpend)
  const tiktokSpendPen = safeNum(tiktokCurrent.spendPen)
  const tiktokSpendCop = safeNum(tiktokCurrent.spendCop)
  const prevMetaSpendCop = safeNum(metaPrevious.totalSpend)
  const prevTiktokSpendCop = safeNum(tiktokPrevious.spendCop)

  const metaPurchases = safeNum(metaCurrent.purchases)
  const tiktokPurchases = safeNum(tiktokCurrent.purchases)
  const prevMetaPurchases = safeNum(metaPrevious.purchases)
  const prevTiktokPurchases = safeNum(tiktokPrevious.purchases)

  const totalSpendCop = metaSpendCop + tiktokSpendCop
  const prevTotalSpendCop = prevMetaSpendCop + prevTiktokSpendCop
  const totalPurchases = metaPurchases + tiktokPurchases
  const prevTotalPurchases = prevMetaPurchases + prevTiktokPurchases
  const totalCpaCop = computeBlendedCpaCop(totalSpendCop, totalPurchases)
  const prevTotalCpaCop = computeBlendedCpaCop(
    prevTotalSpendCop,
    prevTotalPurchases
  )

  return {
    dateRange,
    penToCopRate,
    meta: {
      spendCop: metaSpendCop,
      purchases: metaPurchases,
      purchasesChangePct: percentChange(metaPurchases, prevMetaPurchases),
      cpa: safeNum(metaCurrent.cpa),
      spendChangePct: percentChange(metaSpendCop, prevMetaSpendCop),
      cpaChangePct: percentChange(
        safeNum(metaCurrent.cpa),
        safeNum(metaPrevious.cpa)
      ),
    },
    tiktok: {
      spendPen: tiktokSpendPen,
      spendCop: tiktokSpendCop,
      purchases: tiktokPurchases,
      purchasesChangePct: percentChange(tiktokPurchases, prevTiktokPurchases),
      cpa: safeNum(tiktokCurrent.cpaCop),
      cpaPen: safeNum(tiktokCurrent.cpaPen),
      spendChangePct: percentChange(tiktokSpendCop, prevTiktokSpendCop),
      cpaChangePct: percentChange(
        safeNum(tiktokCurrent.cpaCop),
        safeNum(tiktokPrevious.cpaCop)
      ),
    },
    total: {
      spendCop: totalSpendCop,
      spendChangePct: percentChange(totalSpendCop, prevTotalSpendCop),
      purchases: totalPurchases,
      purchasesChangePct: percentChange(totalPurchases, prevTotalPurchases),
      cpaCop: totalCpaCop,
      cpaChangePct: percentChange(totalCpaCop, prevTotalCpaCop),
    },
  }
}

export async function getSummaryKpis(dateRange: DateRange): Promise<SummaryKpis> {
  const cacheKey = `summary-kpis:v5:${dateRange.from}:${dateRange.to}:${getPenToCopRate()}`
  return withMetaCache(cacheKey, SUMMARY_TTL_MS, () => fetchSummaryKpis(dateRange))
}
