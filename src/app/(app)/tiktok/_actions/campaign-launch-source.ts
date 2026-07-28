"use server"

import { createServerAction } from "@/lib/server-action"
import {
  listTikTokCampaignLaunchSources,
  setTikTokCampaignLaunchSource,
  type TikTokCampaignLaunchSourceValue,
} from "@/lib/services/tiktok/campaign-launch-source"

export const listTikTokCampaignLaunchSourcesAction = createServerAction(
  async () => listTikTokCampaignLaunchSources()
)

export const setTikTokCampaignLaunchSourceAction = createServerAction(
  async (input: {
    campaignId: string
    source: TikTokCampaignLaunchSourceValue | null
  }) => setTikTokCampaignLaunchSource(input)
)
