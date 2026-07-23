"use server"

import { createServerAction } from "@/lib/server-action"
import { getMetaCampaignVideoThumbnails } from "@/lib/services/meta/campaign-video-thumbnails"

export const getMetaCampaignVideoThumbnailsAction = createServerAction(
  async (campaignId: string) => getMetaCampaignVideoThumbnails(campaignId)
)
