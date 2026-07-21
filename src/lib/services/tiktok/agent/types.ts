export type TikTokAgentTrigger =
  | "manual"
  | "morning_6am"
  | "morning_8am"
  | "afternoon_2pm"
  | "evening_8pm"

export type TikTokAgentActionKind =
  | "pause_adgroup"
  | "pause_campaign"
  | "scale_adgroup"
  | "activate_campaign"

export type TikTokAgentPlannedAction = {
  kind: TikTokAgentActionKind
  entityId: string
  entityName: string
  campaignId?: string
  campaignName?: string
  spendPen: number
  purchases: number
  cpaPen: number
  reason: string
  applied: boolean
  error?: string
  /** Presupuesto diario antes del escalado (solo scale_adgroup). */
  budgetBeforePen?: number
  /** Presupuesto diario después del escalado (solo scale_adgroup). */
  budgetAfterPen?: number
  /** % de aumento aplicado (solo scale_adgroup). */
  budgetIncreasePercent?: number
}

export type TikTokAgentThresholds = {
  adsetPauseSpendPen: number
  campaignPauseSpendPen: number
  adsetCpaCriticoPen: number
  telegramNotify: boolean
  activateAt6amEnabled: boolean
  scaleBestEnabled: boolean
  scaleBestBudgetIncreasePercent: number
}

export type TikTokAgentRunSummary = {
  runId: string
  trigger: TikTokAgentTrigger
  status: "running" | "success" | "failed"
  dryRun: boolean
  startedAt: string
  finishedAt: string | null
  accountsScanned: number
  campaignsScanned: number
  adgroupsScanned: number
  actionsCount: number
  summary: string | null
  errorMessage: string | null
  actions: TikTokAgentPlannedAction[]
}
