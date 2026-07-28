export type TikTokCampaignKanbanOutcome = "winner" | "loser"

export type TikTokCampaignKanbanOutcomeRow = {
  campaignId: string
  outcome: TikTokCampaignKanbanOutcome
}

export const KANBAN_OUTCOMES_QUERY_KEY = [
  "tiktok-campaign-kanban-outcomes",
] as const
