import { convertPenToCop } from "@/lib/format/pen-to-cop"
import { withMetaCache } from "@/lib/services/meta/meta-cache"
import { getMetaCampaignDailyInsights } from "@/lib/services/meta/campaign-daily-insights"
import type { DateRange } from "@/lib/services/meta/types"
import {
  buildTotals,
  listProducts,
  mergeMetaDailyInsights,
  mergeTikTokDailyInsights,
  type ProductDailyInsight,
  type ProductRecord,
  type ProductSalesTotals,
} from "@/lib/services/product"
import {
  getTikTokCampaignDailyInsights,
  type TikTokCampaignDailyInsightsSummary,
} from "@/lib/services/tiktok/campaign-daily-insights"
import { computeBlendedCpaCop, safeNum } from "./safe-number"

const SUMMARY_PRODUCTS_TTL_MS = 2 * 60 * 1000
const META_OBJECTIVE = "OUTCOME_SALES"

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

function totalsToMetrics(totals: ProductSalesTotals): SummaryProductPlatformMetrics | null {
  const { spend, purchases, cpa } = totals
  if (spend <= 0 && purchases <= 0) return null
  return { spend, purchases, cpa }
}

function buildPlatformMetricsFromCampaignIds(
  campaignIds: string[],
  summaries: Array<{ days: ProductDailyInsight[] }>
): SummaryProductPlatformMetrics | null {
  if (campaignIds.length === 0) return null
  const days = mergeMetaDailyInsights(summaries)
  return totalsToMetrics(buildTotals(days))
}

function buildTikTokMetricsFromSummaries(
  summaries: TikTokCampaignDailyInsightsSummary[]
): SummaryProductPlatformMetrics | null {
  if (summaries.length === 0) return null
  const days = mergeTikTokDailyInsights(summaries)
  return totalsToMetrics(buildTotals(days))
}

function buildRow(
  product: ProductRecord,
  metaByCampaign: Map<string, Awaited<ReturnType<typeof getMetaCampaignDailyInsights>>>,
  tiktokByCampaign: Map<
    string,
    Awaited<ReturnType<typeof getTikTokCampaignDailyInsights>>
  >
): SummaryProductTableRow {
  const metaIds = product.campaigns
    .filter((c) => c.platform === "meta")
    .map((c) => c.campaignId)
  const tiktokIds = product.campaigns
    .filter((c) => c.platform === "tiktok")
    .map((c) => c.campaignId)

  const metaSummaries = metaIds
    .map((id) => metaByCampaign.get(id))
    .filter((s): s is NonNullable<typeof s> => s != null)
    .map((s) => ({
      days: s.days.map((d) => ({
        date: d.date,
        spend: d.spend,
        purchases: d.purchases,
        cpa: d.cpa,
      })),
    }))

  const tiktokSummaries = tiktokIds
    .map((id) => tiktokByCampaign.get(id))
    .filter((s): s is TikTokCampaignDailyInsightsSummary => s != null)

  const meta = buildPlatformMetricsFromCampaignIds(metaIds, metaSummaries)
  const tiktok = buildTikTokMetricsFromSummaries(tiktokSummaries)

  const metaSpendCop = safeNum(meta?.spend)
  const tiktokSpendCop = convertPenToCop(safeNum(tiktok?.spend))
  const totalSpendCop = metaSpendCop + tiktokSpendCop
  const totalPurchases = safeNum(meta?.purchases) + safeNum(tiktok?.purchases)

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
}

async function loadUniqueCampaignInsights(
  dateRange: DateRange,
  products: ProductRecord[]
) {
  const metaIds = [
    ...new Set(
      products.flatMap((p) =>
        p.campaigns
          .filter((c) => c.platform === "meta")
          .map((c) => c.campaignId)
      )
    ),
  ]
  const tiktokIds = [
    ...new Set(
      products.flatMap((p) =>
        p.campaigns
          .filter((c) => c.platform === "tiktok")
          .map((c) => c.campaignId)
      )
    ),
  ]

  const [metaEntries, tiktokEntries] = await Promise.all([
    Promise.all(
      metaIds.map(async (id) => {
        const summary = await getMetaCampaignDailyInsights(
          id,
          dateRange,
          META_OBJECTIVE
        )
        return [id, summary] as const
      })
    ),
    Promise.all(
      tiktokIds.map(async (id) => {
        const summary = await getTikTokCampaignDailyInsights(id, dateRange)
        return [id, summary] as const
      })
    ),
  ])

  return {
    metaByCampaign: new Map(metaEntries),
    tiktokByCampaign: new Map(tiktokEntries),
  }
}

async function fetchSummaryProductsTable(
  dateRange: DateRange
): Promise<SummaryProductsTable> {
  const products = await listProducts()
  const { metaByCampaign, tiktokByCampaign } = await loadUniqueCampaignInsights(
    dateRange,
    products
  )

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
  const cacheKey = `summary-products:v2:${dateRange.from}:${dateRange.to}`
  return withMetaCache(cacheKey, SUMMARY_PRODUCTS_TTL_MS, () =>
    fetchSummaryProductsTable(dateRange)
  )
}
