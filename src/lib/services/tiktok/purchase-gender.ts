import type { DateRange } from "@/lib/services/meta/types"
import type { PurchasesByGender } from "@/lib/services/meta/purchase-gender"
import {
  fetchIntegratedReport,
  getMetricNumber,
  getPurchases,
} from "./report"

const AUDIENCE_GENDER_METRICS = [
  "spend",
  "complete_payment",
  "total_purchase",
  "purchase",
] as const

function emptyGenderCounts(): PurchasesByGender {
  return { male: 0, female: 0, unknown: 0 }
}

function normalizeTikTokGender(raw: string | undefined): keyof PurchasesByGender {
  const g = (raw ?? "").trim().toUpperCase()
  if (g.includes("FEMALE") || g === "2") return "female"
  if (g.includes("MALE") || g === "1") return "male"
  return "unknown"
}

function addToBucket(
  counts: PurchasesByGender,
  bucket: keyof PurchasesByGender,
  value: number
): PurchasesByGender {
  return { ...counts, [bucket]: counts[bucket] + value }
}

function allocatePurchasesBySpend(
  totalPurchases: number,
  spendByGender: PurchasesByGender
): PurchasesByGender {
  if (totalPurchases <= 0) return emptyGenderCounts()

  const totalSpend =
    spendByGender.male + spendByGender.female + spendByGender.unknown
  if (totalSpend <= 0) return emptyGenderCounts()

  const male = Math.round((totalPurchases * spendByGender.male) / totalSpend)
  const female = Math.round((totalPurchases * spendByGender.female) / totalSpend)
  const unknown = Math.max(0, totalPurchases - male - female)

  return { male, female, unknown }
}

type AdGenderAccum = {
  spend: PurchasesByGender
  directPurchases: PurchasesByGender
}

function mergeAudienceRows(rows: Awaited<ReturnType<typeof fetchIntegratedReport>>) {
  const byAdId = new Map<string, AdGenderAccum>()

  for (const row of rows) {
    const adId = row.dimensions.ad_id?.trim()
    if (!adId) continue

    const bucket = normalizeTikTokGender(row.dimensions.gender)
    const spend = getMetricNumber(row.metrics, "spend")
    const purchases = getPurchases(row.metrics)

    const current = byAdId.get(adId) ?? {
      spend: emptyGenderCounts(),
      directPurchases: emptyGenderCounts(),
    }

    current.spend = addToBucket(current.spend, bucket, spend)
    if (purchases > 0) {
      current.directPurchases = addToBucket(
        current.directPurchases,
        bucket,
        purchases
      )
    }

    byAdId.set(adId, current)
  }

  return byAdId
}

function buildMapFromAccum(
  byAdId: Map<string, AdGenderAccum>,
  fallbackPurchasesByAdId: Map<string, number>
): Map<string, PurchasesByGender> {
  const result = new Map<string, PurchasesByGender>()

  for (const [adId, accum] of byAdId) {
    const directTotal =
      accum.directPurchases.male +
      accum.directPurchases.female +
      accum.directPurchases.unknown

    if (directTotal > 0) {
      result.set(adId, accum.directPurchases)
      continue
    }

    const adPurchases = fallbackPurchasesByAdId.get(adId) ?? 0
    result.set(adId, allocatePurchasesBySpend(adPurchases, accum.spend))
  }

  return result
}

/** Reparto de gasto por género a nivel cuenta (fallback). */
async function fetchAdvertiserGenderSpendShare(
  dateRange: DateRange
): Promise<PurchasesByGender | null> {
  try {
    const rows = await fetchIntegratedReport(
      "AUCTION_ADVERTISER",
      ["gender"],
      ["spend"],
      dateRange.from,
      dateRange.to,
      { reportType: "AUDIENCE" }
    )

    let spend = emptyGenderCounts()
    for (const row of rows) {
      const bucket = normalizeTikTokGender(row.dimensions.gender)
      const value = getMetricNumber(row.metrics, "spend")
      spend = addToBucket(spend, bucket, value)
    }

    const total = spend.male + spend.female + spend.unknown
    if (total <= 0) return null
    return spend
  } catch (error) {
    console.error("TikTok advertiser audience gender failed:", error)
    return null
  }
}

/**
 * Estima compras por género en TikTok:
 * 1) reporte AUDIENCE por anuncio + género (compras directas si existen),
 * 2) si no, reparte compras del anuncio según % de gasto por género,
 * 3) si falla, usa el promedio de gasto por género a nivel cuenta.
 */
export async function fetchTikTokPurchaseGenderByAdId(
  dateRange: DateRange,
  fallbackPurchasesByAdId: Map<string, number>
): Promise<Map<string, PurchasesByGender>> {
  try {
    const rows = await fetchIntegratedReport(
      "AUCTION_AD",
      ["ad_id", "gender"],
      [...AUDIENCE_GENDER_METRICS],
      dateRange.from,
      dateRange.to,
      { reportType: "AUDIENCE" }
    )

    const byAdId = mergeAudienceRows(rows)
    const result = buildMapFromAccum(byAdId, fallbackPurchasesByAdId)

    if (result.size > 0) return result
  } catch (error) {
    console.error("TikTok ad audience gender failed:", error)
  }

  const accountSpend = await fetchAdvertiserGenderSpendShare(dateRange)
  if (!accountSpend) return new Map()

  const result = new Map<string, PurchasesByGender>()
  for (const [adId, purchases] of fallbackPurchasesByAdId) {
    if (purchases <= 0) continue
    result.set(adId, allocatePurchasesBySpend(purchases, accountSpend))
  }

  return result
}
