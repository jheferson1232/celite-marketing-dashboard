import type { AdInsightRow, MetaAction } from "@/lib/services/meta/types"
import { formatCurrency, type CurrencyCode } from "@/lib/format"

export function extractAction(
  actions: MetaAction[] | undefined,
  actionType: string
): number {
  if (!actions) return 0
  const found = actions.find((a) => a.action_type === actionType)
  return found ? parseFloat(found.value) : 0
}

export function extractPurchases(row: AdInsightRow): number {
  return (
    extractAction(row.actions, "complete_payment") ||
    extractAction(row.actions, "purchase") ||
    extractAction(row.actions, "offsite_conversion.fb_pixel_purchase") ||
    extractAction(row.actions, "omni_purchase")
  )
}

export function extractPurchaseValue(row: AdInsightRow): number {
  return (
    extractAction(row.action_values, "purchase") ||
    extractAction(row.action_values, "offsite_conversion.fb_pixel_purchase") ||
    extractAction(row.action_values, "omni_purchase")
  )
}

/** CPA = gasto total / compras (no el cost_per_action_type de Meta, que puede ser incorrecto al agrupar). */
export function calculateCpa(row: AdInsightRow): number {
  const purchases = extractPurchases(row)
  const spend = parseFloat(row.spend) || 0
  if (purchases <= 0) return 0
  return spend / purchases
}

export function extractRoas(row: AdInsightRow): number {
  if (row.purchase_roas && row.purchase_roas.length > 0) {
    return parseFloat(row.purchase_roas[0].value) || 0
  }
  return 0
}

const COMMENT_ACTION_TYPES = [
  "comment",
  "post_comment",
  "onsite_conversion.post_comment",
] as const

export function extractComments(row: AdInsightRow): number {
  return COMMENT_ACTION_TYPES.reduce(
    (sum, type) => sum + extractAction(row.actions, type),
    0
  )
}

export function getCreatedTimeMs(row: AdInsightRow): number {
  if (!row.created_time) return 0
  const ms = Date.parse(row.created_time)
  return Number.isNaN(ms) ? 0 : ms
}

export function mergeEarliestCreatedTime(
  group: AdInsightRow[]
): string | undefined {
  const timestamps = group
    .map((row) => getCreatedTimeMs(row))
    .filter((ms) => ms > 0)

  if (timestamps.length === 0) return undefined
  return new Date(Math.min(...timestamps)).toISOString()
}

export type MetricKey =
  | "spend"
  | "impressions"
  | "clicks"
  | "ctr"
  | "cpc"
  | "roas"
  | "purchases"
  | "cpa"
  | "created_at"
  | "comments"

export const METRIC_OPTIONS: { key: MetricKey; label: string }[] = [
  { key: "spend", label: "Gasto" },
  { key: "impressions", label: "Impresiones" },
  { key: "clicks", label: "Clics" },
  { key: "ctr", label: "CTR" },
  { key: "cpc", label: "CPC" },
  { key: "roas", label: "ROAS" },
  { key: "purchases", label: "Compras" },
  { key: "cpa", label: "CPA" },
  { key: "created_at", label: "Fecha de creación" },
  { key: "comments", label: "Comentarios" },
]

export function getMetricValue(row: AdInsightRow, metric: MetricKey): number {
  switch (metric) {
    case "spend":
      return parseFloat(row.spend) || 0
    case "impressions":
      return parseFloat(row.impressions) || 0
    case "clicks":
      return parseFloat(row.clicks) || 0
    case "ctr":
      return parseFloat(row.ctr) || 0
    case "cpc":
      return parseFloat(row.cpc) || 0
    case "roas":
      return extractRoas(row)
    case "purchases":
      return extractPurchases(row)
    case "cpa":
      return calculateCpa(row)
    case "comments":
      return extractComments(row)
    case "created_at":
      return getCreatedTimeMs(row)
    default:
      return 0
  }
}

export function formatMetricValue(
  value: number,
  metric: MetricKey,
  currency: CurrencyCode = "COP"
): string {
  if (!value && value !== 0) return "—"

  switch (metric) {
    case "impressions":
    case "clicks":
    case "purchases":
    case "comments":
      return new Intl.NumberFormat("es-ES").format(value)
    case "created_at":
      if (!value) return "—"
      return new Intl.DateTimeFormat("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(value))
    case "ctr":
      return `${value.toFixed(2)}%`
    case "roas":
      return `${value.toFixed(2)}x`
    case "spend":
    case "cpc":
    case "cpa":
      return formatCurrency(value, currency)
    default:
      return String(value)
  }
}

export function normThumb(url: string): string {
  if (!url) return ""
  try {
    const u = new URL(url)
    const parts = u.pathname.split("/")
    return parts[parts.length - 1] || u.pathname
  } catch {
    return url
  }
}

export function getCreativeKey(row: AdInsightRow): string {
  const thumb = normThumb(row.thumbnail_url)
  if (row.video_id && thumb) return `vid:${row.video_id}:thumb:${thumb}`
  if (row.video_id) return `vid:${row.video_id}`
  if (thumb) return `thumb:${thumb}`
  return `name:${(row.ad_name || row.ad_id || "").trim().toLowerCase()}`
}
