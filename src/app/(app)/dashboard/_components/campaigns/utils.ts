import type { CampaignAdSetRow, CampaignRow } from "@/lib/services/meta/types"
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
  if (currency === "PEN") {
    return {
      /** CPA &lt; esto con venta → Excelente (equiv. 10k COP Informe IA). */
      excelenteMaxCpa: 10,
      /** CPA &gt; esto con venta → Crítico (equiv. 20k COP). */
      criticoMinCpa: 20,
      /** Gasto sin compras ≥ esto → Crítico (equiv. 10k COP conjuntos). */
      criticoSinComprasMinSpend: 20,
      criticoMinSpend: 30_000,
      excelenteMinSpend: 20_000,
    }
  }

  return {
    excelenteMaxCpa: 10_000,
    criticoMinCpa: 20_000,
    criticoSinComprasMinSpend: 10_000,
    criticoMinSpend: 30_000,
    excelenteMinSpend: 20_000,
  }
}

/** Campaña Meta con interruptor en ON (nivel campaña). */
export function isMetaCampaignActive(row: CampaignRow): boolean {
  return row.status === "ACTIVE"
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

export function hasTikTokAdSetActivityInPeriod(row: CampaignAdSetRow): boolean {
  return row.spend > 0 || row.impressions > 0
}

export function isTikTokAdSetActive(row: CampaignAdSetRow): boolean {
  return row.status === "ACTIVE"
}

/**
 * Rendimiento TikTok (excelente / en curso / crítico), alineado a Informe IA:
 * con ventas → por CPA (&lt;10 excelente, 10–20 en curso, &gt;20 crítico);
 * sin compras → crítico si gasto ≥ umbral.
 */
function getTikTokPerformanceStatusFromMetrics(
  spend: number,
  costPerResult: number,
  results: number,
  currency: CurrencyCode
): CampaignPerformanceStatus {
  const { excelenteMaxCpa, criticoMinCpa, criticoSinComprasMinSpend } =
    getPerformanceThresholds(currency)

  if (results > 0 && costPerResult > 0) {
    if (costPerResult < excelenteMaxCpa) return "EXCELENTE"
    if (costPerResult <= criticoMinCpa) return "EN_CURSO"
    return "CRITICO"
  }

  if (results === 0 && spend >= criticoSinComprasMinSpend) {
    return "CRITICO"
  }

  return "EN_CURSO"
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
  return getTikTokPerformanceStatusFromMetrics(
    row.spend,
    row.costPerResult,
    row.results,
    currency
  )
}

/** Rendimiento del conjunto TikTok (misma escala que Informe IA, en PEN). */
export function getTikTokAdSetPerformanceStatus(
  row: CampaignAdSetRow,
  currency: CurrencyCode = TIKTOK_DASHBOARD_CURRENCY
): CampaignPerformanceStatus | null {
  if (!hasTikTokAdSetActivityInPeriod(row)) return null
  return getTikTokPerformanceStatusFromMetrics(
    row.spend,
    row.costPerResult,
    row.results,
    currency
  )
}

const TIKTOK_ESTADO_LABEL: Record<
  Exclude<CampaignPerformanceStatus, "APAGADO">,
  string
> = {
  EXCELENTE: "Excelente",
  EN_CURSO: "En curso",
  CRITICO: "Crítico",
}

const TIKTOK_ESTADO_TONE_CLASS: Record<
  Exclude<CampaignPerformanceStatus, "APAGADO">,
  string
> = {
  EXCELENTE: "font-medium text-green-600 dark:text-green-400",
  EN_CURSO: "font-medium text-orange-600 dark:text-orange-400",
  CRITICO: "font-medium text-red-600 dark:text-red-400",
}

export function getTikTokAdSetEstadoDisplay(
  row: CampaignAdSetRow,
  currency: CurrencyCode = TIKTOK_DASHBOARD_CURRENCY
): { label: string; className: string } | null {
  const status = getTikTokAdSetPerformanceStatus(row, currency)
  if (!status || status === "APAGADO") return null
  return {
    label: TIKTOK_ESTADO_LABEL[status],
    className: TIKTOK_ESTADO_TONE_CLASS[status],
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

  if (currency === "PEN") {
    return getTikTokCostPerResultCellClassName(costPerResult)
  }

  return getMetaCostPerResultCellClassName(costPerResult)
}
