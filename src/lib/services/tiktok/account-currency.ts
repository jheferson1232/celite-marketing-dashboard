import type { CurrencyCode } from "@/lib/format"
import { TIKTOK_DASHBOARD_CURRENCY } from "@/lib/format"

/** Moneda de la cuenta TikTok (API / BD) → código del dashboard. Sin conversión de montos. */
export function resolveTikTokAccountCurrency(
  apiCurrency: string | null | undefined
): CurrencyCode {
  const normalized = apiCurrency?.trim().toUpperCase()
  if (normalized === "COP") return "COP"
  if (normalized === "PEN") return "PEN"
  if (normalized === "MXN" || normalized === "MX") return "MX"
  return TIKTOK_DASHBOARD_CURRENCY
}

/** Código visible del presupuesto (COP, PEN, MXN). */
export function tikTokAccountCurrencyLabel(currency: CurrencyCode): string {
  if (currency === "MX") return "MXN"
  return currency
}
