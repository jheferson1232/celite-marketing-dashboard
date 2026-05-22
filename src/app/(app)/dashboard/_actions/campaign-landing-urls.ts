"use server"

import { createServerAction } from "@/lib/server-action"
import { getMetaCampaignLandingUrlsCached } from "@/lib/services/meta/campaign-landing-urls-service"

export const getMetaCampaignLandingUrlsAction = createServerAction(
  async (campaignId: string): Promise<string[]> =>
    getMetaCampaignLandingUrlsCached(campaignId)
)
