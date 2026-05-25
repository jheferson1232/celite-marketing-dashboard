export const CAMPAIGN_STATUS_VALUES = [
  "draft",
  "ready",
  "running",
  "archived",
] as const

export type CampaignStatus = (typeof CAMPAIGN_STATUS_VALUES)[number]

/** Columnas visibles en el tablero Kanban (sin «Listo»). */
export const CAMPAIGN_KANBAN_STATUS_VALUES = [
  "draft",
  "running",
  "archived",
] as const satisfies readonly CampaignStatus[]

export type CampaignKanbanStatus = (typeof CAMPAIGN_KANBAN_STATUS_VALUES)[number]

export function isCampaignStatus(value: string): value is CampaignStatus {
  return (CAMPAIGN_STATUS_VALUES as readonly string[]).includes(value)
}

export function isCampaignKanbanStatus(
  value: string
): value is CampaignKanbanStatus {
  return (CAMPAIGN_KANBAN_STATUS_VALUES as readonly string[]).includes(value)
}

/** «ready» se mueve a Borrador en el tablero. */
export function getCampaignKanbanColumn(
  status: CampaignStatus
): CampaignKanbanStatus {
  if (status === "ready") return "draft"
  return status
}
