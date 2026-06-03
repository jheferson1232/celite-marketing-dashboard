export type TikTokAgentTrigger =
  | "manual"
  | "morning_8am"
  | "afternoon_2pm"
  | "evening_8pm"

export type TikTokAgentActionKind =
  | "pause_adgroup"
  | "pause_campaign"

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
}

export type TikTokAgentThresholds = {
  adsetPauseSpendPen: number
  campaignPauseSpendPen: number
  adsetCpaCriticoPen: number
  telegramNotify: boolean
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
