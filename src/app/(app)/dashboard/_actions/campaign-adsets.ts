"use server"

import { createServerAction } from "@/lib/server-action"
import { getCampaignAdSetsByCampaignId } from "@/lib/services/meta/campaign-adsets"
import type { CampaignAdSetRow, DateRange } from "@/lib/services/meta/types"

export const getCampaignAdSets = createServerAction(
  async ({
    campaignId,
    dateRange,
    objective,
  }: {
    campaignId: string
    dateRange: DateRange
    objective: string
  }): Promise<CampaignAdSetRow[]> =>
    getCampaignAdSetsByCampaignId(campaignId, dateRange, objective)
)
