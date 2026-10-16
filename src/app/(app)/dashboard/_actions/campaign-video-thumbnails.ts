"use server"

import { createServerAction } from "@/lib/server-action"
import { getMetaCampaignVideoThumbnails } from "@/lib/services/meta/campaign-video-thumbnails"
import { withMetaDashboardAccount } from "@/lib/services/meta/meta-dashboard-account.server"

export const getMetaCampaignVideoThumbnailsAction = createServerAction(
  async (input: string | { campaignId: string; accountId?: string }) => {
    const campaignId = typeof input === "string" ? input : input.campaignId
    const accountId = typeof input === "string" ? undefined : input.accountId
    return withMetaDashboardAccount(accountId, () =>
      getMetaCampaignVideoThumbnails(campaignId)
    )
  }
)
