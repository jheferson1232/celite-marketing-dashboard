import { convertPenToCop } from "@/lib/format/pen-to-cop"
import {
  campaignInsightsToMap,
  fetchAllCampaignInsights,
} from "@/lib/services/meta/campaign-insights-fetch"
import { getMetaClient } from "@/lib/services/meta/meta"
import { withMetaCache } from "@/lib/services/meta/meta-cache"
import { normalizeMetaId } from "@/lib/services/meta/meta-ids"
import { pacedMetaRequest } from "@/lib/services/meta/meta-request-pacing"
import { getPurchaseSpendAndCpaFromInsight } from "@/lib/services/meta/purchase-metrics"
import type { DateRange } from "@/lib/services/meta/types"
import { listProducts, type ProductRecord } from "@/lib/services/product"
import {
  fetchCachedCampaignMetricsByDateRange,
  getPurchaseSpendAndCpa,
} from "@/lib/services/tiktok/report"
import { getProductCoverImage } from "@/lib/products/cover-image"
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

function aggregatePlatformMetrics(
  campaignIds: string[],
  byCampaign: Map<string, SummaryProductPlatformMetrics>,
  normalizeId: (id: string) => string = (id) => id
): SummaryProductPlatformMetrics | null {
  if (campaignIds.length === 0) return null

  let spend = 0
  let purchases = 0
  for (const id of campaignIds) {
    const metrics = byCampaign.get(normalizeId(id))
    if (!metrics) continue
    spend += metrics.spend
    purchases += metrics.purchases
  }

  if (spend <= 0 && purchases <= 0) return null
  return {
    spend,
    purchases,
    cpa: purchases > 0 ? spend / purchases : 0,
  }
}

function buildRow(
  product: ProductRecord,
  metaByCampaign: Map<string, SummaryProductPlatformMetrics>,
  tiktokByCampaign: Map<string, SummaryProductPlatformMetrics>
): SummaryProductTableRow {
  const metaIds = product.campaigns
    .filter((c) => c.platform === "meta")
    .map((c) => c.campaignId)
  const tiktokIds = product.campaigns
    .filter((c) => c.platform === "tiktok")
    .map((c) => c.campaignId)

  const meta = aggregatePlatformMetrics(metaIds, metaByCampaign, normalizeMetaId)
  const tiktok = aggregatePlatformMetrics(tiktokIds, tiktokByCampaign)

  const metaSpendCop = safeNum(meta?.spend)
  const tiktokSpendCop = convertPenToCop(safeNum(tiktok?.spend))
  const totalSpendCop = metaSpendCop + tiktokSpendCop
  const totalPurchases = safeNum(meta?.purchases) + safeNum(tiktok?.purchases)

  return {
    id: product.id,
    name: product.name,
    imageUrl: getProductCoverImage(product),
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
}

/** Una consulta Meta + una TikTok por rango (totales por campaña), sin N llamadas serializadas. */
async function loadBatchCampaignMetrics(dateRange: DateRange): Promise<{
  metaByCampaign: Map<string, SummaryProductPlatformMetrics>
  tiktokByCampaign: Map<string, SummaryProductPlatformMetrics>
}> {
  const [metaByCampaign, tiktokByCampaign] = await Promise.all([
    pacedMetaRequest(async () => {
      const api = getMetaClient()
      const rows = await fetchAllCampaignInsights(api, dateRange)
      const byInsight = campaignInsightsToMap(rows)
      const metrics = new Map<string, SummaryProductPlatformMetrics>()

      for (const [campaignId, insight] of byInsight) {
        const { spend, purchases, cpa } = getPurchaseSpendAndCpaFromInsight(insight)
        if (spend <= 0 && purchases <= 0) continue
        metrics.set(campaignId, { spend, purchases, cpa })
      }

      return metrics
    }),
    fetchCachedCampaignMetricsByDateRange(dateRange).then((raw) => {
      const metrics = new Map<string, SummaryProductPlatformMetrics>()
      for (const [campaignId, row] of raw) {
        const { spend, purchases, cpa } = getPurchaseSpendAndCpa(row)
        if (spend <= 0 && purchases <= 0) continue
        metrics.set(campaignId, { spend, purchases, cpa })
      }
      return metrics
    }),
  ])

  return { metaByCampaign, tiktokByCampaign }
}

async function fetchSummaryProductsTable(
  dateRange: DateRange
): Promise<SummaryProductsTable> {
  const [products, { metaByCampaign, tiktokByCampaign }] = await Promise.all([
    listProducts(),
    loadBatchCampaignMetrics(dateRange),
  ])

  const rows = products.map((product) =>
    buildRow(product, metaByCampaign, tiktokByCampaign)
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
  const cacheKey = `summary-products:v3:${dateRange.from}:${dateRange.to}`
  return withMetaCache(cacheKey, SUMMARY_PRODUCTS_TTL_MS, () =>
    fetchSummaryProductsTable(dateRange)
  )
}
