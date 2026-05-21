import type { AdInsightRow, MetaAction } from "@/lib/services/meta/types"
import {
  formatCurrency,
  META_DASHBOARD_CURRENCY,
  TIKTOK_DASHBOARD_CURRENCY,
  type CurrencyCode,
} from "@/lib/format"

/** Gasto mínimo (PEN) para mostrar un creativo en el dashboard TikTok. */
export const TIKTOK_MIN_CREATIVE_SPEND_PEN = 2

export function passesTikTokCreativeSpendFilter(
  spend: number | string,
  currency: CurrencyCode
): boolean {
  if (currency !== TIKTOK_DASHBOARD_CURRENCY) return true
  const value = typeof spend === "string" ? parseFloat(spend) : spend
  return Number.isFinite(value) && value >= TIKTOK_MIN_CREATIVE_SPEND_PEN
}

/** Hay al menos un creativo visible (gasto agrupado ≥ umbral en TikTok). */
export function hasVisibleCreativesForAdsView(
  rows: AdInsightRow[],
  currency: CurrencyCode
): boolean {
  if (!rows.length) return false
  if (currency !== TIKTOK_DASHBOARD_CURRENCY) return true

  const map = new Map<string, number>()
  for (const row of rows) {
    const key = getCreativeKey(row)
    const spend = parseFloat(row.spend) || 0
    map.set(key, (map.get(key) ?? 0) + spend)
  }

  for (const totalSpend of map.values()) {
    if (passesTikTokCreativeSpendFilter(totalSpend, currency)) return true
  }
  return false
}

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

/** Columnas numéricas ordenables en la tabla de creativos Meta. */
export const META_CREATIVES_TABLE_METRICS: { key: MetricKey; label: string }[] =
  [
    { key: "spend", label: "Gasto" },
    { key: "purchases", label: "Compras" },
    { key: "cpa", label: "CPA" },
    { key: "created_at", label: "Fecha de creación" },
  ]

export function sumPurchasesByGender(
  group: AdInsightRow[]
): { male: number; female: number; unknown: number } {
  return group.reduce(
    (acc, row) => {
      const g = row.purchasesByGender
      if (!g) return acc
      return {
        male: acc.male + g.male,
        female: acc.female + g.female,
        unknown: acc.unknown + g.unknown,
      }
    },
    { male: 0, female: 0, unknown: 0 }
  )
}

export function countUniqueIds(
  group: AdInsightRow[],
  field: "campaign_id" | "adset_id"
): number {
  return new Set(
    group.map((row) => row[field]).filter((id): id is string => Boolean(id))
  ).size
}

export function genderPurchasePercent(
  count: number,
  total: number
): number {
  if (total <= 0) return 0
  return Math.round((count / total) * 100)
}

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

/** Fila con mayor gasto en el grupo (miniatura / video representativos). */
export function pickHighestSpendRow(group: AdInsightRow[]): AdInsightRow {
  return group.reduce((a, b) =>
    (parseFloat(a.spend) || 0) >= (parseFloat(b.spend) || 0) ? a : b
  )
}

/** Primera URL disponible en el grupo (no solo la del anuncio con más gasto). */
export function pickUrlFromGroup(group: AdInsightRow[]): string {
  for (const row of group) {
    const url = row.url?.trim()
    if (url) return url
  }
  return ""
}

export function pickCampaignNameFromGroup(group: AdInsightRow[]): string {
  for (const row of group) {
    const name = row.campaign_name?.trim()
    if (name) return name
  }
  return ""
}

/** Nombres únicos de conjuntos (ad groups) en el grupo, uno por línea en UI. */
export function pickAdsetNameListFromGroup(group: AdInsightRow[]): string[] {
  const names = new Set<string>()
  for (const row of group) {
    const name = row.adset_name?.trim()
    if (name) names.add(name)
  }
  return [...names].sort((a, b) => a.localeCompare(b, "es"))
}

/** Texto plano (p. ej. atributo title); no usar para mostrar varios conjuntos en una línea. */
export function pickAdsetNamesFromGroup(group: AdInsightRow[]): string {
  return pickAdsetNameListFromGroup(group).join("\n")
}

/** Meta: sin URL en la card → título = nombre de campaña. TikTok: siempre campaña. */
export function getCreativeCardDisplayTitle(
  row: AdInsightRow,
  currency: CurrencyCode = META_DASHBOARD_CURRENCY
): string {
  if (currency === TIKTOK_DASHBOARD_CURRENCY) {
    return row.campaign_name?.trim() || row.ad_name?.trim() || "Sin nombre"
  }
  if (currency === META_DASHBOARD_CURRENCY && !row.url?.trim()) {
    return row.campaign_name?.trim() || row.ad_name?.trim() || "Sin nombre"
  }
  return row.ad_name?.trim() || "Sin nombre"
}

export function getCreativeKey(row: AdInsightRow): string {
  const thumb = normThumb(row.thumbnail_url)
  if (row.video_id && thumb) return `vid:${row.video_id}:thumb:${thumb}`
  if (row.video_id) return `vid:${row.video_id}`
  if (thumb) return `thumb:${thumb}`
  return `name:${(row.ad_name || row.ad_id || "").trim().toLowerCase()}`
}
