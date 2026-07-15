export const CAMPAIGN_STATUS_VALUES = [
  "draft",
  "ready",
  "running",
  "winner",
  "loser",
  "archived",
] as const

export type CampaignStatus = (typeof CAMPAIGN_STATUS_VALUES)[number]

/**
 * Columnas visibles en el Kanban de /campaigns.
 * «ready» se muestra en Borrador; «archived» no aparece.
 */
export const CAMPAIGN_KANBAN_STATUS_VALUES = [
  "draft",
  "running",
  "winner",
  "loser",
] as const satisfies readonly CampaignStatus[]

export type CampaignKanbanStatus = (typeof CAMPAIGN_KANBAN_STATUS_VALUES)[number]

/** Gasto total mínimo (PEN) antes de clasificar En curso → Ganador/Perdedor. */
export const CAMPAIGN_OUTCOME_MIN_SPEND_PEN = 100

/** Umbral CPA lifetime (gasto total / compras totales). */
export const CAMPAIGN_OUTCOME_CPA_THRESHOLD = 15

export function isCampaignStatus(value: string): value is CampaignStatus {
  return (CAMPAIGN_STATUS_VALUES as readonly string[]).includes(value)
}

export function isCampaignKanbanStatus(
  value: string
): value is CampaignKanbanStatus {
  return (CAMPAIGN_KANBAN_STATUS_VALUES as readonly string[]).includes(value)
}

/** «ready» se mueve a Borrador en el tablero. «archived» no aparece. */
export function getCampaignKanbanColumn(
  status: CampaignStatus
): CampaignKanbanStatus {
  if (status === "ready") return "draft"
  if (status === "running") return "running"
  if (status === "winner") return "winner"
  if (status === "loser") return "loser"
  return "draft"
}

export function isCampaignVisibleOnKanban(status: CampaignStatus): boolean {
  return status !== "archived"
}

/**
 * Columna del kanban. Si el estado sigue en «running» pero el gasto/CPA
 * ya califican, usa winner/loser (para no depender solo del persist en DB).
 */
export function resolveCampaignKanbanColumn(input: {
  status: CampaignStatus
  metrics?: {
    totalSpend: number
    totalPurchases: number
    totalCpa: number
  } | null
}): CampaignKanbanStatus {
  const column = getCampaignKanbanColumn(input.status)
  if (column !== "running" || !input.metrics) return column

  return (
    classifyCampaignOutcome({
      totalSpend: input.metrics.totalSpend,
      totalPurchases: input.metrics.totalPurchases,
      totalCpa: input.metrics.totalCpa,
    }) ?? column
  )
}

/**
 * Clasifica por CPA lifetime cuando el gasto total supera el mínimo.
 * Devuelve null si aún debe quedarse en «En curso».
 */
export function classifyCampaignOutcome(input: {
  totalSpend: number
  totalPurchases: number
  totalCpa?: number
  minSpend?: number
  cpaThreshold?: number
}): "winner" | "loser" | null {
  const minSpend = input.minSpend ?? CAMPAIGN_OUTCOME_MIN_SPEND_PEN
  const threshold = input.cpaThreshold ?? CAMPAIGN_OUTCOME_CPA_THRESHOLD
  const spend = Number.isFinite(input.totalSpend) ? input.totalSpend : 0
  const purchases = Number.isFinite(input.totalPurchases)
    ? input.totalPurchases
    : 0

  if (spend < minSpend) return null

  const cpa =
    typeof input.totalCpa === "number" && Number.isFinite(input.totalCpa)
      ? input.totalCpa
      : purchases > 0
        ? spend / purchases
        : Number.POSITIVE_INFINITY

  if (!Number.isFinite(cpa) || purchases <= 0) return "loser"
  if (cpa < threshold) return "winner"
  if (cpa > threshold) return "loser"
  return "winner"
}
