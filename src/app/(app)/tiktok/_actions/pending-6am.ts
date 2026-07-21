"use server"

import { createServerAction } from "@/lib/server-action"
import {
  listPendingActivateCampaigns,
  removeCampaignFrom6amQueue,
} from "@/lib/services/tiktok/agent/pending-6am-activation"

export const listPendingActivateCampaignsAction = createServerAction(async () =>
  listPendingActivateCampaigns()
)

export const removePendingActivateCampaignAction = createServerAction(
  async (campaignId: string) => removeCampaignFrom6amQueue(campaignId)
)
