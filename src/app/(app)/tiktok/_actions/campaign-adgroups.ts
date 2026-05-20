"use server"

import { createServerAction } from "@/lib/server-action"
import { getTikTokCampaignAdGroupsByCampaignId } from "@/lib/services/tiktok/campaign-adgroups"
import type { CampaignAdSetRow, DateRange } from "@/lib/services/meta/types"

export const getTikTokCampaignAdGroups = createServerAction(
  async ({
    campaignId,
    dateRange,
  }: {
    campaignId: string
    dateRange: DateRange
    objective?: string
  }): Promise<CampaignAdSetRow[]> =>
    getTikTokCampaignAdGroupsByCampaignId(campaignId, dateRange)
)
