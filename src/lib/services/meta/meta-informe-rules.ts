import type { CurrencyCode } from "@/lib/format"

/**
 * Reglas del Informe IA por cuenta: todo sale de un CPA objetivo en la moneda
 * de la cuenta, así sirve igual para COP (Mokado Katy) y PEN (Mokado CP).
 */

/** CPA &lt; objetivo × esto con ventas → Excelente. */
export const INFORME_EXCELENTE_RATIO = 0.8
/** CPA &gt; objetivo × esto → Revisar. */
export const INFORME_REVISAR_CPA_RATIO = 1.5
/** Gasto ≥ objetivo × esto sin compras → Revisar. */
export const INFORME_REVISAR_SPEND_RATIO = 1
/** Gasto ≥ objetivo × esto sin compras → Apagar. */
export const INFORME_APAGAR_SPEND_RATIO = 1.5
/** Compras mínimas en el periodo para sugerir reactivar un conjunto OFF. */
export const INFORME_REACTIVAR_MIN_PURCHASES = 3

/** Objetivo por defecto si la cuenta aún no tiene uno guardado. */
export function defaultInformeCpaTarget(currency: CurrencyCode): number {
  switch (currency) {
    case "PEN":
      return 25
    case "MX":
      return 150
    default:
      return 12_000
  }
}

export type InformeAccion =
  | "apagar"
  | "revisar"
  | "en_curso"
  | "excelente"
  | "reactivar"
  | "apagado"
  | "sin_gasto"

export const INFORME_ACCION_LABEL: Record<InformeAccion, string> = {
  apagar: "Apagar",
  revisar: "Revisar",
  en_curso: "En curso",
  excelente: "Excelente",
  reactivar: "Reactivar",
  apagado: "Apagado",
  sin_gasto: "Sin gasto",
}

/** Orden de urgencia (menor = más urgente). */
export const INFORME_ACCION_ORDER: Record<InformeAccion, number> = {
  apagar: 0,
  revisar: 1,
  reactivar: 2,
  en_curso: 3,
  excelente: 4,
  sin_gasto: 5,
  apagado: 6,
}

export type InformeDayTone = "good" | "warn" | "bad" | "neutral" | "none"

type DayMetrics = { spend: number; purchases: number }

/** Estado de un día aislado (sin mirar si el conjunto está ON). */
function dayAccion(
  day: DayMetrics,
  target: number
): "apagar" | "revisar" | "en_curso" | "excelente" | "sin_gasto" {
  const { spend, purchases } = day
  if (spend <= 0) return "sin_gasto"
  if (purchases === 0) {
    if (spend >= target * INFORME_APAGAR_SPEND_RATIO) return "apagar"
    if (spend >= target * INFORME_REVISAR_SPEND_RATIO) return "revisar"
    return "en_curso"
  }
  const cpa = spend / purchases
  if (cpa > target * INFORME_REVISAR_CPA_RATIO) return "revisar"
  if (cpa < target * INFORME_EXCELENTE_RATIO) return "excelente"
  return "en_curso"
}

export type InformeAccionInput = {
  isActive: boolean
  today: DayMetrics
  yesterday: DayMetrics
  /** Totales del periodo del informe (7 días). */
  period: DayMetrics
}

export type InformeAccionResult = {
  accion: InformeAccion
  /** Motivo corto, en la moneda ya formateada por el llamador. */
  reason: InformeAccionReason
}

export type InformeAccionReason =
  | { kind: "sin_compras"; spend: number; ratio: number }
  | { kind: "cpa"; cpa: number; ratio: number; purchases: number }
  | { kind: "revisar_dos_dias"; cpa: number | null; spend: number }
  | { kind: "periodo"; cpa: number; ratio: number; purchases: number }
  | { kind: "sin_gasto" }
  | { kind: "apagado" }

/** Acción recomendada para un conjunto (o campaña) según el CPA objetivo. */
export function computeInformeAccion(
  input: InformeAccionInput,
  target: number
): InformeAccionResult {
  const { isActive, today, yesterday, period } = input

  if (!isActive) {
    const periodCpa =
      period.purchases > 0 ? period.spend / period.purchases : 0
    if (
      period.purchases >= INFORME_REACTIVAR_MIN_PURCHASES &&
      periodCpa > 0 &&
      periodCpa < target
    ) {
      return {
        accion: "reactivar",
        reason: {
          kind: "periodo",
          cpa: periodCpa,
          ratio: periodCpa / target,
          purchases: period.purchases,
        },
      }
    }
    return { accion: "apagado", reason: { kind: "apagado" } }
  }

  const todayAccion = dayAccion(today, target)
  if (todayAccion === "sin_gasto") {
    return { accion: "sin_gasto", reason: { kind: "sin_gasto" } }
  }

  const cpaToday = today.purchases > 0 ? today.spend / today.purchases : null
  const reason: InformeAccionReason =
    cpaToday === null
      ? { kind: "sin_compras", spend: today.spend, ratio: today.spend / target }
      : {
          kind: "cpa",
          cpa: cpaToday,
          ratio: cpaToday / target,
          purchases: today.purchases,
        }

  if (todayAccion === "revisar") {
    const yesterdayAccion = dayAccion(yesterday, target)
    if (yesterdayAccion === "revisar" || yesterdayAccion === "apagar") {
      return {
        accion: "apagar",
        reason: { kind: "revisar_dos_dias", cpa: cpaToday, spend: today.spend },
      }
    }
  }

  return { accion: todayAccion, reason }
}

/** Color de una celda diaria de la matriz. */
export function informeDayTone(day: DayMetrics, target: number): InformeDayTone {
  const { spend, purchases } = day
  if (spend <= 0) return "none"
  if (purchases === 0) {
    return spend >= target * INFORME_REVISAR_SPEND_RATIO ? "bad" : "neutral"
  }
  const cpa = spend / purchases
  if (cpa <= target) return "good"
  if (cpa <= target * INFORME_REVISAR_CPA_RATIO) return "warn"
  return "bad"
}

/** Tono del CPA respecto al objetivo (KPIs). */
export function informeCpaTone(cpa: number, target: number): InformeDayTone {
  if (cpa <= 0) return "none"
  if (cpa < target * INFORME_EXCELENTE_RATIO) return "good"
  if (cpa <= target * INFORME_REVISAR_CPA_RATIO) return "warn"
  return "bad"
}

function formatRatio(ratio: number): string {
  return `${ratio.toFixed(ratio >= 10 ? 0 : 1)}× objetivo`
}

/** Motivo legible de una acción, p. ej. «$18,400 sin compras (1.5× objetivo)». */
export function describeInformeReason(
  reason: InformeAccionReason,
  formatMoney: (value: number) => string
): string {
  switch (reason.kind) {
    case "sin_compras":
      return `${formatMoney(reason.spend)} hoy sin compras (${formatRatio(reason.ratio)})`
    case "cpa":
      return `CPA hoy ${formatMoney(reason.cpa)} (${formatRatio(reason.ratio)}) · ${reason.purchases} compra${reason.purchases === 1 ? "" : "s"}`
    case "revisar_dos_dias":
      return reason.cpa === null
        ? `${formatMoney(reason.spend)} hoy sin compras · 2 días seguidos fuera de objetivo`
        : `CPA hoy ${formatMoney(reason.cpa)} · 2 días seguidos fuera de objetivo`
    case "periodo":
      return `7 días: ${reason.purchases} compras · CPA ${formatMoney(reason.cpa)} (${formatRatio(reason.ratio)})`
    case "sin_gasto":
      return "Sin gasto hoy"
    case "apagado":
      return "Apagado"
  }
}
