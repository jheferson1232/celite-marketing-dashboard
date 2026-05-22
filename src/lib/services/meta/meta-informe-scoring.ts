/** Umbrales COP acordados para Informe IA. */
export const INFORME_SPEND_LOW_COP = 5_000
export const INFORME_SPEND_PENALTY_COP = 10_000
/** Conjunto: gasto hoy ≥ esto y 0 compras → aviso Telegram (apagar). */
export const INFORME_ADSET_APAGAR_SPEND_COP = 10_000
/** Campaña: gasto hoy ≥ esto y 0 compras → aviso Telegram (apagar). */
export const INFORME_CAMPAIGN_APAGAR_SPEND_COP = 30_000
/** CPA &lt; 10k con venta → +1 */
export const INFORME_CPA_GOOD_COP = 10_000
export const INFORME_CPA_PENALTY_COP = 15_000

export type InformeEstadoKind =
  | "ok"
  | "sin_ventas"
  | "cpa_alto"
  | "gasto_alto_ayer"
  | "neutral"

export type InformeScoreInput = {
  spendToday: number
  purchasesToday: number
  cpaToday: number
  yesterdaySpend?: number
}

export type InformeScoreResult = {
  points: number | null
  estadoKind: InformeEstadoKind
  estadoLabel: string
  rowHighlight: "none" | "red"
}

export function computeInformeScore(input: InformeScoreInput): InformeScoreResult {
  const { spendToday, purchasesToday, cpaToday, yesterdaySpend = 0 } = input

  /** Ayer gastó ≥10k → hoy −1 (aunque hoy no gaste o venda bien). */
  if (yesterdaySpend >= INFORME_SPEND_PENALTY_COP) {
    return {
      points: -1,
      estadoKind: "gasto_alto_ayer",
      estadoLabel: "Gasto alto ayer",
      rowHighlight: "red",
    }
  }

  if (spendToday <= 0) {
    return {
      points: null,
      estadoKind: "neutral",
      estadoLabel: "—",
      rowHighlight: "none",
    }
  }

  if (purchasesToday === 0) {
    if (spendToday < INFORME_SPEND_LOW_COP) {
      return {
        points: 0,
        estadoKind: "neutral",
        estadoLabel: "Sin ventas",
        rowHighlight: "none",
      }
    }
    if (spendToday >= INFORME_SPEND_PENALTY_COP) {
      return {
        points: -1,
        estadoKind: "sin_ventas",
        estadoLabel: "Sin ventas",
        rowHighlight: "red",
      }
    }
    return {
      points: 0,
      estadoKind: "sin_ventas",
      estadoLabel: "Sin ventas",
      rowHighlight: "red",
    }
  }

  if (cpaToday > INFORME_CPA_PENALTY_COP) {
    return {
      points: -1,
      estadoKind: "cpa_alto",
      estadoLabel: "CPA alto",
      rowHighlight: "red",
    }
  }

  if (cpaToday > 0 && cpaToday < INFORME_CPA_GOOD_COP) {
    return {
      points: 1,
      estadoKind: "ok",
      estadoLabel: "OK",
      rowHighlight: "none",
    }
  }

  return {
    points: 0,
    estadoKind: "ok",
    estadoLabel: "OK",
    rowHighlight: "none",
  }
}

/**
 * Suma del rango (ayer + hoy): como máximo −1 por conjunto/campaña.
 * Las celdas diarias pueden mostrar −1 cada una; el total no acumula −2.
 */
export function finalizePointsTotal(_dayCells: unknown[], rawTotal: number): number {
  if (rawTotal < -1) return -1
  return rawTotal
}

export function formatInformePoints(points: number | null): string {
  if (points === null) return "—"
  if (points > 0) return `+${points}`
  return String(points)
}

export type AdsetEstadoTodayTone = "green" | "orange" | "red" | "muted"

export type AdsetEstadoTodayDisplay = {
  label: string
  hint?: string
  tone: AdsetEstadoTodayTone
  title: string
}

const META_CPA_RED_COP = 20_000

function getMetaCpaTodayTone(
  cpa: number
): "green" | "orange" | "red" | null {
  if (cpa <= 0) return null
  if (cpa > META_CPA_RED_COP) return "red"
  if (cpa >= INFORME_CPA_GOOD_COP) return "orange"
  return "green"
}

function getInformeEstadoTodayDisplay(input: {
  spendToday: number
  purchasesToday: number
  cpaToday: number
  sinComprasCriticoCOP: number
}): AdsetEstadoTodayDisplay {
  const { spendToday, purchasesToday, cpaToday, sinComprasCriticoCOP } = input

  if (purchasesToday > 0 && cpaToday > 0) {
    const tone = getMetaCpaTodayTone(cpaToday)!
    const label =
      tone === "green"
        ? "Excelente"
        : tone === "orange"
          ? "En curso"
          : "Crítico"
    return {
      label,
      tone,
      title:
        tone === "green"
          ? `CPA hoy < ${INFORME_CPA_GOOD_COP.toLocaleString("es-CO")} COP`
          : tone === "orange"
            ? `CPA hoy ${INFORME_CPA_GOOD_COP.toLocaleString("es-CO")}–${META_CPA_RED_COP.toLocaleString("es-CO")} COP`
            : `CPA hoy > ${META_CPA_RED_COP.toLocaleString("es-CO")} COP`,
    }
  }

  if (purchasesToday === 0 && spendToday >= sinComprasCriticoCOP) {
    return {
      label: "Crítico",
      tone: "red",
      title: `≥${sinComprasCriticoCOP.toLocaleString("es-CO")} COP hoy sin compras`,
    }
  }

  if (purchasesToday === 0 && spendToday >= INFORME_SPEND_PENALTY_COP) {
    return {
      label: "En curso",
      hint: "Sin compras aún",
      tone: "orange",
      title: "Gasto hoy sin compras",
    }
  }

  if (spendToday > 0 && purchasesToday === 0) {
    return {
      label: "En curso",
      hint: "Sin compras aún",
      tone: "orange",
      title: "Poco gasto hoy sin compras",
    }
  }

  return {
    label: "—",
    tone: "muted",
    title: "Sin gasto hoy",
  }
}

/** Estado visible en tabla (campañas): basado en hoy, alineado a colores CPA Meta. */
export function getCampaignEstadoTodayDisplay(input: {
  spendToday: number
  purchasesToday: number
  cpaToday: number
}): AdsetEstadoTodayDisplay {
  return getInformeEstadoTodayDisplay({
    ...input,
    sinComprasCriticoCOP: INFORME_CAMPAIGN_APAGAR_SPEND_COP,
  })
}

/** Estado visible en tabla (conjuntos): misma escala que campañas; crítico sin compras ≥10k. */
export function getAdsetEstadoTodayDisplay(input: {
  spendToday: number
  purchasesToday: number
  cpaToday: number
}): AdsetEstadoTodayDisplay {
  return getInformeEstadoTodayDisplay({
    ...input,
    sinComprasCriticoCOP: INFORME_ADSET_APAGAR_SPEND_COP,
  })
}
