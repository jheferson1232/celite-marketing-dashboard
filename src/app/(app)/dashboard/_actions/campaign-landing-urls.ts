"use server"

import { createServerAction } from "@/lib/server-action"
import { getMetaCampaignLandingUrlsCached } from "@/lib/services/meta/campaign-landing-urls-service"
import { withMetaDashboardAccount } from "@/lib/services/meta/meta-dashboard-account.server"

export const getMetaCampaignLandingUrlsAction = createServerAction(
  async (
    input: string | { campaignId: string; accountId?: string }
  ): Promise<string[]> => {
    const campaignId = typeof input === "string" ? input : input.campaignId
    const accountId = typeof input === "string" ? undefined : input.accountId
    return withMetaDashboardAccount(accountId, () =>
      getMetaCampaignLandingUrlsCached(campaignId)
    )
  }
)
