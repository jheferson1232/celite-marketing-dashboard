/**
 * callback_data de Telegram (máx. 64 bytes).
 * Formato compacto con pipes.
 *
 * s|p|{campaignId}     — seleccionar campaña para pausar (muestra confirmación)
 * s|a|{campaignId}   — seleccionar campaña para activar
 * s|pa|{adgroupId}  — seleccionar conjunto para pausar
 * s|b|{adgroupId}    — elegir conjunto para cambiar presupuesto
 * s|bm|{adgroupId}|{budget} — elegir monto de presupuesto (confirmación)
 * s|bpc|{adgroupId}|{percent} — elegir % de presupuesto (confirmación)
 * c|p|{campaignId}   — confirmar pausar campaña
 * c|a|{campaignId}   — confirmar activar campaña
 * c|b|{adgroupId}|{budget} — confirmar presupuesto exacto PEN
 * c|bp|{adgroupId}|{percent} — confirmar +N% presupuesto
 * c|pg|{adgroupId}   — confirmar pausar conjunto
 * x                  — cancelar
 */

export type CallbackAction =
  | { type: "select_pause"; campaignId: string }
  | { type: "select_activate"; campaignId: string }
  | { type: "select_pause_adgroup"; adgroupId: string }
  | { type: "select_budget"; adgroupId: string }
  | { type: "select_budget_amount"; adgroupId: string; budget: number }
  | { type: "select_budget_percent_pick"; adgroupId: string; percent: number }
  | { type: "confirm_pause"; campaignId: string }
  | { type: "confirm_activate"; campaignId: string }
  | { type: "confirm_pause_adgroup"; adgroupId: string }
  | { type: "confirm_budget"; adgroupId: string; budget: number }
  | { type: "confirm_budget_percent"; adgroupId: string; percent: number }
  | { type: "cancel" }

export function encodeCallback(action: CallbackAction): string {
  switch (action.type) {
    case "select_pause":
      return `s|p|${action.campaignId}`
    case "select_activate":
      return `s|a|${action.campaignId}`
    case "select_pause_adgroup":
      return `s|pa|${action.adgroupId}`
    case "select_budget":
      return `s|b|${action.adgroupId}`
    case "select_budget_amount":
      return `s|bm|${action.adgroupId}|${action.budget}`
    case "select_budget_percent_pick":
      return `s|bpc|${action.adgroupId}|${action.percent}`
    case "confirm_pause":
      return `c|p|${action.campaignId}`
    case "confirm_activate":
      return `c|a|${action.campaignId}`
    case "confirm_pause_adgroup":
      return `c|pg|${action.adgroupId}`
    case "confirm_budget":
      return `c|b|${action.adgroupId}|${action.budget}`
    case "confirm_budget_percent":
      return `c|bp|${action.adgroupId}|${action.percent}`
    case "cancel":
      return "x"
  }
}

export function decodeCallback(data: string): CallbackAction | null {
  if (data === "x") return { type: "cancel" }

  const parts = data.split("|")
  if (parts.length < 2) return null

  const [kind, op, id, extra] = parts

  if (kind === "s") {
    if (op === "p" && id) return { type: "select_pause", campaignId: id }
    if (op === "a" && id) return { type: "select_activate", campaignId: id }
    if (op === "pa" && id) return { type: "select_pause_adgroup", adgroupId: id }
    if (op === "b" && id) return { type: "select_budget", adgroupId: id }
    if (op === "bm" && id && extra) {
      const budget = Number(extra)
      if (Number.isFinite(budget) && budget > 0) {
        return { type: "select_budget_amount", adgroupId: id, budget }
      }
    }
    if (op === "bpc" && id && extra) {
      const percent = Number(extra)
      if (Number.isFinite(percent)) {
        return {
          type: "select_budget_percent_pick",
          adgroupId: id,
          percent,
        }
      }
    }
  }

  if (kind === "c") {
    if (op === "p" && id) return { type: "confirm_pause", campaignId: id }
    if (op === "a" && id) return { type: "confirm_activate", campaignId: id }
    if (op === "pg" && id) return { type: "confirm_pause_adgroup", adgroupId: id }
    if (op === "b" && id && extra) {
      const budget = Number(extra)
      if (Number.isFinite(budget) && budget > 0) {
        return { type: "confirm_budget", adgroupId: id, budget }
      }
    }
    if (op === "bp" && id && extra) {
      const percent = Number(extra)
      if (Number.isFinite(percent)) {
        return {
          type: "confirm_budget_percent",
          adgroupId: id,
          percent,
        }
      }
    }
  }

  return null
}

export function assertCallbackDataLength(data: string): string {
  if (data.length > 64) {
    throw new Error(`callback_data demasiado largo (${data.length}/64)`)
  }
  return data
}
