import {
  META_DASHBOARD_CURRENCY,
  TIKTOK_DASHBOARD_CURRENCY,
  type CurrencyCode,
} from "@/lib/format"
import type { AccountKpis } from "@/lib/services/meta/types"

const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  COP: "pesos colombianos (COP)",
  PEN: "soles peruanos (PEN)",
  MX: "pesos mexicanos (MXN)",
}

export type ChatPlatform = "meta" | "tiktok"

export function getPlatformCurrency(platform: ChatPlatform): CurrencyCode {
  return platform === "tiktok" ? TIKTOK_DASHBOARD_CURRENCY : META_DASHBOARD_CURRENCY
}

export function wrapAccountKpis(
  platform: ChatPlatform,
  kpis: AccountKpis
) {
  const currency = getPlatformCurrency(platform)
  return {
    platform,
    platformLabel: platform === "tiktok" ? "TikTok Ads" : "Meta Ads",
    currency,
    currencyLabel: CURRENCY_LABELS[currency],
    ...kpis,
  }
}
