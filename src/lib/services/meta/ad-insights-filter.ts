import type { AdInsightRow } from "./types"

function parseMetric(value: string | undefined): number {
  const n = parseFloat(value ?? "0")
  return Number.isNaN(n) ? 0 : n
}

/** Anuncio con entrega o resultado en el rango de fechas (oculta filas vacías de insights). */
export function hasAdDeliveryInPeriod(row: AdInsightRow): boolean {
  const spend = parseMetric(row.spend)
  const impressions = parseMetric(row.impressions)
  const clicks = parseMetric(row.clicks)

  if (spend > 0 || impressions > 0 || clicks > 0) return true

  const purchases =
    row.actions?.find(
      (a) =>
        a.action_type === "omni_purchase" ||
        a.action_type === "purchase" ||
        a.action_type === "offsite_conversion.fb_pixel_purchase"
    )?.value ?? "0"

  return parseInt(purchases, 10) > 0
}
