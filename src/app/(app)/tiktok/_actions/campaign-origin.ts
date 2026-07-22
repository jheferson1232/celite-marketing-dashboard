"use server"

import { createServerAction } from "@/lib/server-action"
import {
  listTikTokCampaignOrigins,
  setTikTokCampaignOrigin,
  type TikTokCampaignOriginValue,
} from "@/lib/services/tiktok/campaign-origin"

export const listTikTokCampaignOriginsAction = createServerAction(async () =>
  listTikTokCampaignOrigins()
)

export const setTikTokCampaignOriginAction = createServerAction(
  async (input: {
    campaignId: string
    origin: TikTokCampaignOriginValue | null
  }) => setTikTokCampaignOrigin(input)
)
