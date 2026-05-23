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

export type InformeEstadoFilter = "ALL" | "EXCELENTE" | "EN_CURSO" | "CRITICO"

export type InformeEstadoFilterKey = "EXCELENTE" | "EN_CURSO" | "CRITICO"

export function getInformeEntityEstadoDisplay(entity: {
  type: "campaign" | "adset"
  spendToday: number
  purchasesToday: number
  cpaToday: number
}): AdsetEstadoTodayDisplay {
  return entity.type === "campaign"
    ? getCampaignEstadoTodayDisplay(entity)
    : getAdsetEstadoTodayDisplay(entity)
}

export function informeEstadoToneToFilterKey(
  tone: AdsetEstadoTodayTone
): InformeEstadoFilterKey | null {
  if (tone === "green") return "EXCELENTE"
  if (tone === "orange") return "EN_CURSO"
  if (tone === "red") return "CRITICO"
  return null
}

export function informeEstadoFilterForEntity(entity: {
  type: "campaign" | "adset"
  spendToday: number
  purchasesToday: number
  cpaToday: number
}): InformeEstadoFilterKey | null {
  return informeEstadoToneToFilterKey(
    getInformeEntityEstadoDisplay(entity).tone
  )
}

/** Gasto total del informe sin compras → no activar (conjunto). */
export const INFORME_PERIOD_ADSET_SIN_VENTAS_CRITICO_COP = 35_000
/** Gasto total del informe sin compras → no activar (campaña). */
export const INFORME_PERIOD_CAMPAIGN_SIN_VENTAS_CRITICO_COP = 100_000

export type InformeAccionRecomendada = "activar" | "revisar" | "no_activar"

export type InformePeriodAccionDisplay = AdsetEstadoTodayDisplay & {
  accion: InformeAccionRecomendada
  accionLabel: string
}

const INFORME_ACCION_LABEL: Record<InformeAccionRecomendada, string> = {
  activar: "Sí activar",
  revisar: "Revisar antes de activar",
  no_activar: "No activar",
}

function accionFromTone(tone: AdsetEstadoTodayTone): InformeAccionRecomendada {
  if (tone === "green") return "activar"
  if (tone === "red") return "no_activar"
  return "revisar"
}

function getInformePeriodEstadoDisplay(input: {
  spendTotal: number
  purchasesTotal: number
  cpaTotal: number
  sinComprasCriticoCOP: number
  sinComprasRevisarCOP: number
}): InformePeriodAccionDisplay {
  const { spendTotal, purchasesTotal, cpaTotal, sinComprasCriticoCOP, sinComprasRevisarCOP } =
    input

  if (purchasesTotal > 0 && cpaTotal > 0) {
    const tone = getMetaCpaTodayTone(cpaTotal)!
    const label =
      tone === "green"
        ? "Excelente"
        : tone === "orange"
          ? "En curso"
          : "Crítico"
    const accion = accionFromTone(tone)
    return {
      label,
      tone,
      accion,
      accionLabel: INFORME_ACCION_LABEL[accion],
      title:
        tone === "green"
          ? `CPA total < ${INFORME_CPA_GOOD_COP.toLocaleString("es-CO")} COP · ${purchasesTotal} compra(s)`
          : tone === "orange"
            ? `CPA total ${INFORME_CPA_GOOD_COP.toLocaleString("es-CO")}–${META_CPA_RED_COP.toLocaleString("es-CO")} COP`
            : `CPA total > ${META_CPA_RED_COP.toLocaleString("es-CO")} COP`,
    }
  }

  if (purchasesTotal === 0 && spendTotal >= sinComprasCriticoCOP) {
    return {
      label: "Crítico",
      hint: "Sin compras en el periodo",
      tone: "red",
      accion: "no_activar",
      accionLabel: INFORME_ACCION_LABEL.no_activar,
      title: `≥${sinComprasCriticoCOP.toLocaleString("es-CO")} COP de gasto total sin compras`,
    }
  }

  if (purchasesTotal === 0 && spendTotal >= sinComprasRevisarCOP) {
    return {
      label: "En curso",
      hint: "Sin compras aún",
      tone: "orange",
      accion: "revisar",
      accionLabel: INFORME_ACCION_LABEL.revisar,
      title: `Gasto total ≥${sinComprasRevisarCOP.toLocaleString("es-CO")} COP sin compras en el periodo`,
    }
  }

  if (spendTotal > 0 && purchasesTotal === 0) {
    return {
      label: "En curso",
      hint: "Poco gasto",
      tone: "orange",
      accion: "revisar",
      accionLabel: INFORME_ACCION_LABEL.revisar,
      title: "Gasto total bajo sin compras",
    }
  }

  return {
    label: "—",
    tone: "muted",
    accion: "revisar",
    accionLabel: INFORME_ACCION_LABEL.revisar,
    title: "Sin gasto en el periodo",
  }
}

/** Recomendación según gasto total + compras del informe (no solo hoy). */
export function getInformeEntityPeriodAccionDisplay(entity: {
  type: "campaign" | "adset"
  spendInformeTotal: number
  purchasesInformeTotal: number
  cpaInformeTotal: number
}): InformePeriodAccionDisplay {
  if (entity.type === "campaign") {
    return getInformePeriodEstadoDisplay({
      spendTotal: entity.spendInformeTotal,
      purchasesTotal: entity.purchasesInformeTotal,
      cpaTotal: entity.cpaInformeTotal,
      sinComprasCriticoCOP: INFORME_PERIOD_CAMPAIGN_SIN_VENTAS_CRITICO_COP,
      sinComprasRevisarCOP: INFORME_CAMPAIGN_APAGAR_SPEND_COP,
    })
  }
  return getInformePeriodEstadoDisplay({
    spendTotal: entity.spendInformeTotal,
    purchasesTotal: entity.purchasesInformeTotal,
    cpaTotal: entity.cpaInformeTotal,
    sinComprasCriticoCOP: INFORME_PERIOD_ADSET_SIN_VENTAS_CRITICO_COP,
    sinComprasRevisarCOP: INFORME_ADSET_APAGAR_SPEND_COP,
  })
}

export type InformeResumenItem = {
  row: import("./meta-operative-service").InformeEntityRow
  campaignName: string
  display: InformePeriodAccionDisplay
}

export function buildInformeAdsetResumenItems(
  groups: import("./meta-operative-service").InformeCampaignGroup[]
): InformeResumenItem[] {
  const items: InformeResumenItem[] = []
  for (const group of groups) {
    for (const adset of group.adsets) {
      if (adset.type !== "adset" || adset.spendInformeTotal <= 0) continue
      items.push({
        row: adset,
        campaignName: group.campaign.name,
        display: getInformeEntityPeriodAccionDisplay({
          type: "adset",
          spendInformeTotal: adset.spendInformeTotal,
          purchasesInformeTotal: adset.purchasesInformeTotal,
          cpaInformeTotal: adset.cpaInformeTotal,
        }),
      })
    }
  }
  return items
}

export function groupInformeResumenByAccion(items: InformeResumenItem[]): Record<
  InformeAccionRecomendada,
  InformeResumenItem[]
> {
  const sortBySpend = (a: InformeResumenItem, b: InformeResumenItem) =>
    b.row.spendInformeTotal - a.row.spendInformeTotal

  return {
    activar: items.filter((i) => i.display.accion === "activar").sort(sortBySpend),
    revisar: items.filter((i) => i.display.accion === "revisar").sort(sortBySpend),
    no_activar: items
      .filter((i) => i.display.accion === "no_activar")
      .sort(sortBySpend),
  }
}

export function countInformeResumenAcciones(
  items: InformeResumenItem[]
): Record<InformeAccionRecomendada, number> {
  return {
    activar: items.filter((i) => i.display.accion === "activar").length,
    revisar: items.filter((i) => i.display.accion === "revisar").length,
    no_activar: items.filter((i) => i.display.accion === "no_activar").length,
  }
}

export function informePeriodFilterForEntity(entity: {
  type: "campaign" | "adset"
  spendInformeTotal: number
  purchasesInformeTotal: number
  cpaInformeTotal: number
}): InformeEstadoFilterKey | null {
  return informeEstadoToneToFilterKey(
    getInformeEntityPeriodAccionDisplay(entity).tone
  )
}

/** Conjunto OFF con compras y CPA total &lt; 10k → conviene activar en Meta. */
export function shouldInformeActivateAdset(row: {
  type: "campaign" | "adset"
  metaWasActive: boolean
  spendInformeTotal: number
  purchasesInformeTotal: number
  cpaInformeTotal: number
}): boolean {
  if (row.type !== "adset") return false
  if (row.metaWasActive) return false
  if (row.spendInformeTotal <= 0) return false
  if (row.purchasesInformeTotal <= 0) return false
  if (row.cpaInformeTotal <= 0) return false
  return row.cpaInformeTotal < INFORME_CPA_GOOD_COP
}

export function countInformeActivateAdsets(
  groups: import("./meta-operative-service").InformeCampaignGroup[]
): number {
  let count = 0
  for (const group of groups) {
    for (const adset of group.adsets) {
      if (shouldInformeActivateAdset(adset)) count++
    }
  }
  return count
}

export function countInformePeriodFilters(
  groups: import("./meta-operative-service").InformeCampaignGroup[]
): Record<InformeEstadoFilterKey, number> {
  const counts: Record<InformeEstadoFilterKey, number> = {
    EXCELENTE: 0,
    EN_CURSO: 0,
    CRITICO: 0,
  }
  for (const group of groups) {
    for (const adset of group.adsets) {
      if (adset.spendInformeTotal <= 0) continue
      const key = informePeriodFilterForEntity(adset)
      if (key) counts[key]++
    }
  }
  return counts
}

export function informeResumenPeriodFilterKey(
  item: InformeResumenItem
): InformeEstadoFilterKey | null {
  return informeEstadoToneToFilterKey(item.display.tone)
}

export function countInformeResumenPeriodFilters(
  items: InformeResumenItem[]
): Record<InformeEstadoFilterKey, number> {
  const counts: Record<InformeEstadoFilterKey, number> = {
    EXCELENTE: 0,
    EN_CURSO: 0,
    CRITICO: 0,
  }
  for (const item of items) {
    const key = informeResumenPeriodFilterKey(item)
    if (key) counts[key]++
  }
  return counts
}

export function filterInformeResumenItems(
  items: InformeResumenItem[],
  filter: InformeEstadoFilter
): InformeResumenItem[] {
  if (filter === "ALL") return items
  return items.filter(
    (item) => informeResumenPeriodFilterKey(item) === filter
  )
}

export function sumInformeResumenSpend(items: InformeResumenItem[]): number {
  return items.reduce((sum, item) => sum + item.row.spendInformeTotal, 0)
}
