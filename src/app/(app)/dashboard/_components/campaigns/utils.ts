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

/** Campaña TikTok con interruptor en ON (nivel campaña, no conjuntos). */
export function isTikTokCampaignActiveToday(row: CampaignRow): boolean {
  if (row.operationStatus === "ENABLE" || row.operationStatus === "DISABLE") {
    return row.operationStatus === "ENABLE"
  }
  return row.status === "ACTIVE"
}

export function hasTikTokCampaignActivityInPeriod(row: CampaignRow): boolean {
  return row.spend > 0 || row.impressions > 0
}

/**
 * Rendimiento TikTok (excelente / en curso / crítico).
 * Sin clasificar "apagado" por gasto cero: eso va al chip operativo (interruptor OFF).
 */
export function getTikTokCampaignPerformanceStatus(
  row: CampaignRow,
  currency: CurrencyCode = TIKTOK_DASHBOARD_CURRENCY
): CampaignPerformanceStatus | null {
  if (!hasTikTokCampaignActivityInPeriod(row)) return null

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

  if (
    spend >= excelenteMinSpend &&
    costPerResult > 0 &&
    costPerResult < excelenteMaxCpa
  ) {
    return "EXCELENTE"
  }

  return "EN_CURSO"
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

const COST_PER_RESULT_CELL_CLASSES = {
  green:
    "bg-green-50 text-green-800 dark:bg-green-500/15 dark:text-green-400",
  orange:
    "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
  red: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-400",
} as const

function getMetaCostPerResultCellClassName(costPerResult: number): string {
  if (costPerResult > 20_000) return COST_PER_RESULT_CELL_CLASSES.red
  if (costPerResult >= 10_000) return COST_PER_RESULT_CELL_CLASSES.orange
  return COST_PER_RESULT_CELL_CLASSES.green
}

function getTikTokCostPerResultCellClassName(costPerResult: number): string {
  if (costPerResult > 20) return COST_PER_RESULT_CELL_CLASSES.red
  if (costPerResult > 10) return COST_PER_RESULT_CELL_CLASSES.orange
  return COST_PER_RESULT_CELL_CLASSES.green
}

/** Fondo de celda Costo/Res: verde (bajo), naranja en curso, rojo crítico. */
export function getCostPerResultCellClassName(
  costPerResult: number,
  currency: CurrencyCode = "COP"
): string | undefined {
  if (costPerResult <= 0) return undefined

  if (currency === TIKTOK_DASHBOARD_CURRENCY) {
    return getTikTokCostPerResultCellClassName(costPerResult)
  }

  return getMetaCostPerResultCellClassName(costPerResult)
}
