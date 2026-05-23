"use server"

import { createServerAction } from "@/lib/server-action"
import type { DateRange } from "@/lib/services/meta/types"
import { getTikTokAdSetsGroupedByCampaign } from "@/lib/services/tiktok/campaign-adgroups"

export const getTikTokAllCampaignAdGroupsAction = createServerAction(
  async (dateRange: DateRange) => getTikTokAdSetsGroupedByCampaign(dateRange)
)
