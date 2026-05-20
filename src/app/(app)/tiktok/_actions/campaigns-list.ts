"use server"

import { createServerAction } from "@/lib/server-action"
import { getTikTokCampaignsList } from "@/lib/services/tiktok/campaigns-list"
import type { CampaignRow, DateRange } from "@/lib/services/meta/types"

export const getTikTokCampaignsListAction = createServerAction(
  async (dateRange: DateRange): Promise<CampaignRow[]> =>
    getTikTokCampaignsList(dateRange)
)
