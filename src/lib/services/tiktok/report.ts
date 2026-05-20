import type { DateRange } from "@/lib/services/meta/types"
import { getTikTokAdvertiserId, getTikTokClient } from "./tiktok"
import { withTikTokCache } from "./tiktok-cache"
import type { TikTokApiResponse, TikTokReportData, TikTokReportRow } from "./types"

const ADGROUP_REPORT_TTL_MS = 2 * 60 * 1000

export type TikTokDataLevel =
  | "AUCTION_ADVERTISER"
  | "AUCTION_CAMPAIGN"
  | "AUCTION_ADGROUP"
  | "AUCTION_AD"

/** TikTok Ads Manager "Website purchase" / Complete Payment maps to `complete_payment`. */
const PURCHASE_METRICS = [
  "complete_payment",
  "total_purchase",
  "purchase",
] as const

export const ACCOUNT_METRICS = [
  "spend",
  "impressions",
  "clicks",
  "ctr",
  "cpc",
  "cpm",
  "complete_payment",
  "total_purchase",
  "purchase",
  "total_purchase_value",
  "complete_payment_roas",
  "web_event_add_to_cart",
] as const

export const CAMPAIGN_METRICS = [
  "spend",
  "impressions",
  "clicks",
  "ctr",
  "cpc",
  "complete_payment",
  "total_purchase",
  "purchase",
  "total_purchase_value",
  "complete_payment_roas",
  "web_event_add_to_cart",
] as const

export const ADGROUP_METRICS = [
  "spend",
  "impressions",
  "clicks",
  "ctr",
  "cpc",
  "complete_payment",
  "total_purchase",
  "purchase",
  "total_purchase_value",
  "complete_payment_roas",
  "web_event_add_to_cart",
] as const

export const AD_METRICS = [
  "spend",
  "impressions",
  "clicks",
  "ctr",
  "cpc",
  "cpm",
  "reach",
  "frequency",
  "complete_payment",
  "total_purchase",
  "purchase",
] as const

/** TikTok engagement metrics vary by account; not all are valid in BASIC reports. */
export const AD_COMMENT_METRICS = ["comments", "comment"] as const

export function getComments(metrics: Record<string, string>): number {
  return getMetricNumber(metrics, ...AD_COMMENT_METRICS)
}

export function getMetricNumber(
  metrics: Record<string, string>,
  ...keys: string[]
): number {
  for (const key of keys) {
    const value = metrics[key]
    if (value !== undefined && value !== "") {
      const parsed = parseFloat(value)
      if (!Number.isNaN(parsed)) return parsed
    }
  }
  return 0
}

export function getPurchases(metrics: Record<string, string>): number {
  for (const key of PURCHASE_METRICS) {
    const value = metrics[key]
    if (value === undefined || value === "") continue
    const parsed = parseFloat(value)
    if (!Number.isNaN(parsed) && parsed > 0) return parsed
  }
  return 0
}

export function getPurchaseValue(metrics: Record<string, string>): number {
  return getMetricNumber(metrics, "total_purchase_value")
}

export function getAddToCart(metrics: Record<string, string>): number {
  return getMetricNumber(
    metrics,
    "web_event_add_to_cart",
    "total_web_event_add_to_cart"
  )
}

export function aggregateReportMetrics(
  rows: TikTokReportRow[]
): Record<string, string> {
  const totals = new Map<string, number>()

  for (const row of rows) {
    for (const [key, value] of Object.entries(row.metrics)) {
      const parsed = parseFloat(value)
      if (Number.isNaN(parsed)) continue
      totals.set(key, (totals.get(key) ?? 0) + parsed)
    }
  }

  return Object.fromEntries(
    [...totals.entries()].map(([key, value]) => [key, String(value)])
  )
}

export function getRoas(metrics: Record<string, string>): number {
  const direct = getMetricNumber(metrics, "complete_payment_roas")
  if (direct > 0) return direct

  const spend = getMetricNumber(metrics, "spend")
  const value = getPurchaseValue(metrics)
  return spend > 0 ? value / spend : 0
}

export async function fetchIntegratedReport(
  dataLevel: TikTokDataLevel,
  dimensions: string[],
  metrics: string[],
  startDate: string,
  endDate: string,
  options?: {
    /** Filtro ya serializado (formato TikTok: field_name, filter_type, filter_value). */
    filtering?: string
  }
): Promise<TikTokReportRow[]> {
  const api = getTikTokClient()
  const advertiserId = getTikTokAdvertiserId()
  const rows: TikTokReportRow[] = []
  let page = 1
  let totalPage = 1

  while (page <= totalPage) {
    const { data } = await api.get<TikTokApiResponse<TikTokReportData>>(
      "/report/integrated/get/",
      {
        params: {
          advertiser_id: advertiserId,
          service_type: "AUCTION",
          report_type: "BASIC",
          data_level: dataLevel,
          dimensions: JSON.stringify(dimensions),
          metrics: JSON.stringify(metrics),
          start_date: startDate,
          end_date: endDate,
          page,
          page_size: 500,
          ...(options?.filtering ? { filtering: options.filtering } : {}),
        },
      }
    )

    rows.push(...(data.data.list ?? []))
    totalPage = data.data.page_info?.total_page ?? 1
    page += 1
  }

  return rows
}

/** TikTok does not support campaign filters on AUCTION_ADGROUP reports; cache full report per range. */
export async function fetchCachedAdGroupMetricsByDateRange(
  dateRange: DateRange
): Promise<Map<string, Record<string, string>>> {
  const cacheKey = `tiktok-adgroup-report:${dateRange.from}:${dateRange.to}`
  return withTikTokCache(cacheKey, ADGROUP_REPORT_TTL_MS, async () => {
    const rows = await fetchIntegratedReport(
      "AUCTION_ADGROUP",
      ["adgroup_id"],
      [...ADGROUP_METRICS],
      dateRange.from,
      dateRange.to
    )

    return new Map(
      rows.map((row) => [row.dimensions.adgroup_id, row.metrics] as const)
    )
  })
}
