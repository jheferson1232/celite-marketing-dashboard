"use server"

import { createServerAction } from "@/lib/create-server-action"
import { listTikTokCampaignKanbanOutcomes } from "@/lib/services/campaign-kanban-outcomes"

export const listTikTokCampaignKanbanOutcomesAction = createServerAction(
  async () => listTikTokCampaignKanbanOutcomes()
)
