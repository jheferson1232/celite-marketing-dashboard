"use server"

import { createServerAction } from "@/lib/server-action"
import {
  archiveTikTokCampaign,
  listArchivedTikTokCampaigns,
  unarchiveTikTokCampaign,
} from "@/lib/services/tiktok/archived-campaigns"

export const listArchivedTikTokCampaignsAction = createServerAction(async () =>
  listArchivedTikTokCampaigns()
)

export const archiveTikTokCampaignAction = createServerAction(
  async (input: { campaignId: string; name: string }) =>
    archiveTikTokCampaign(input)
)

export const unarchiveTikTokCampaignAction = createServerAction(
  async (campaignId: string) => unarchiveTikTokCampaign(campaignId)
)
