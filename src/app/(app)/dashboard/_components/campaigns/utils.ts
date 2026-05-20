import type { CampaignRow } from "@/lib/services/meta/types"
import type { CurrencyCode } from "@/lib/format"
import { TIKTOK_DASHBOARD_CURRENCY } from "@/lib/format"
import type { CampaignPerformanceStatus } from "./types"

const numberFormatter = new Intl.NumberFormat("es-ES")

export function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`
}

/** Umbrales de clasificación por moneda (gasto y CPA en la misma unidad). */
function getPerformanceThresholds(currency: CurrencyCode) {
  if (currency === TIKTOK_DASHBOARD_CURRENCY) {
    return {
      criticoMinSpend: 40,
      criticoMinCpa: 20,
      excelenteMinSpend: 25,
      excelenteMaxCpa: 12,
    }
  }

  return {
    criticoMinSpend: 30_000,
    criticoMinCpa: 15_000,
    excelenteMinSpend: 20_000,
    excelenteMaxCpa: 10_000,
  }
}

export function getCampaignPerformanceStatus(
  row: CampaignRow,
  currency: CurrencyCode = "COP"
): CampaignPerformanceStatus {
  const { spend, costPerResult, results } = row
  const {
    criticoMinSpend,
    criticoMinCpa,
    excelenteMinSpend,
    excelenteMaxCpa,
  } = getPerformanceThresholds(currency)

  if (
    (spend >= criticoMinSpend && costPerResult >= criticoMinCpa) ||
    (spend >= criticoMinSpend && results === 0)
  ) {
    return "CRITICO"
  }

  if (spend === 0 && row.impressions === 0) {
    return "APAGADO"
  }

  if (
    spend >= excelenteMinSpend &&
    costPerResult > 0 &&
    costPerResult < excelenteMaxCpa
  ) {
    return "EXCELENTE"
  }

  return "EN_CURSO"
}

/** Fondo de celda Costo/Res según CPA (umbrales en PEN para TikTok). */
export function getCostPerResultCellClassName(
  costPerResult: number,
  currency: CurrencyCode = "COP"
): string | undefined {
  if (costPerResult <= 0) return undefined

  if (currency === TIKTOK_DASHBOARD_CURRENCY) {
    if (costPerResult > 20) {
      return "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-400"
    }
    if (costPerResult > 10) {
      return "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400"
    }
    return "bg-green-50 dark:bg-green-500/15"
  }

  if (costPerResult > 0 && costPerResult < 10_000) {
    return "bg-green-50 dark:bg-green-500/15"
  }

  return undefined
}
