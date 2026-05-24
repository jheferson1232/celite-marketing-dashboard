import { convertPenToCop } from "@/lib/format/pen-to-cop"
import { withMetaCache } from "@/lib/services/meta/meta-cache"
import type { DateRange } from "@/lib/services/meta/types"
import {
  getProductSalesHistory,
  listProducts,
  type ProductRecord,
} from "@/lib/services/product"
import { computeBlendedCpaCop, safeNum } from "./safe-number"

const SUMMARY_PRODUCTS_TTL_MS = 2 * 60 * 1000

export type SummaryProductPlatformMetrics = {
  spend: number
  purchases: number
  cpa: number
}

export type SummaryProductTableRow = {
  id: string
  name: string
  imageUrl: string | null
  notes: string | null
  campaignCount: number
  meta: SummaryProductPlatformMetrics | null
  tiktok: SummaryProductPlatformMetrics | null
  total: {
    purchases: number
    spendCop: number
    cpaCop: number
  }
}

export type SummaryProductsTable = {
  dateRange: DateRange
  rows: SummaryProductTableRow[]
}

function toPlatformMetrics(
  block: { totals: { spend: number; purchases: number; cpa: number } } | null
): SummaryProductPlatformMetrics | null {
  if (!block) return null
  const { spend, purchases, cpa } = block.totals
  if (spend <= 0 && purchases <= 0) return null
  return { spend, purchases, cpa }
}

function buildRow(
  product: ProductRecord,
  dateRange: DateRange
): Promise<SummaryProductTableRow> {
  return getProductSalesHistory(product.id, dateRange).then((history) => {
    const meta = toPlatformMetrics(history.meta)
    const tiktok = toPlatformMetrics(history.tiktok)
    const metaSpendCop = safeNum(meta?.spend)
    const tiktokSpendCop = convertPenToCop(safeNum(tiktok?.spend))
    const totalSpendCop = metaSpendCop + tiktokSpendCop
    const totalPurchases =
      safeNum(meta?.purchases) + safeNum(tiktok?.purchases)

    return {
      id: product.id,
      name: product.name,
      imageUrl: product.imageUrl,
      notes: product.notes,
      campaignCount: product.campaigns.length,
      meta,
      tiktok,
      total: {
        purchases: totalPurchases,
        spendCop: totalSpendCop,
        cpaCop: computeBlendedCpaCop(totalSpendCop, totalPurchases),
      },
    }
  })
}

async function fetchSummaryProductsTable(
  dateRange: DateRange
): Promise<SummaryProductsTable> {
  const products = await listProducts()
  const rows = await Promise.all(
    products.map((product) => buildRow(product, dateRange))
  )

  rows.sort((a, b) => {
    const byPurchases = b.total.purchases - a.total.purchases
    if (byPurchases !== 0) return byPurchases
    return a.name.localeCompare(b.name, "es")
  })

  return { dateRange, rows }
}

export async function getSummaryProductsTable(
  dateRange: DateRange
): Promise<SummaryProductsTable> {
  const cacheKey = `summary-products:v1:${dateRange.from}:${dateRange.to}`
  return withMetaCache(cacheKey, SUMMARY_PRODUCTS_TTL_MS, () =>
    fetchSummaryProductsTable(dateRange)
  )
}
