"use server"

import { createServerAction } from "@/lib/server-action"
import { getCampaignsList as getCampaignsListService } from "@/lib/services/meta/campaigns-list"
import type { CampaignRow, DateRange } from "@/lib/services/meta/types"

export const getCampaignsList = createServerAction(
  async (dateRange: DateRange): Promise<CampaignRow[]> =>
    getCampaignsListService(dateRange)
)
