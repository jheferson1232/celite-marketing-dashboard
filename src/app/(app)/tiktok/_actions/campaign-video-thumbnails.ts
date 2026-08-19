"use server"

import { createServerAction } from "@/lib/server-action"
import { getTikTokCampaignVideoThumbnails } from "@/lib/services/tiktok/campaign-video-thumbnails"

export const getTikTokCampaignVideoThumbnailsAction = createServerAction(
  async (input: { campaignId: string; accountId?: string }) =>
    getTikTokCampaignVideoThumbnails(input.campaignId, input.accountId)
)
