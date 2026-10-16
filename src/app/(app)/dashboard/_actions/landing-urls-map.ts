"use server"

import { createServerAction } from "@/lib/server-action"
import { getMetaLandingUrlsByCampaignMap } from "@/lib/services/meta/landing-urls-map"
import { withMetaDashboardAccount } from "@/lib/services/meta/meta-dashboard-account.server"

export const getMetaLandingUrlsMapAction = createServerAction(
  async (input?: { accountId?: string }) =>
    withMetaDashboardAccount(input?.accountId, () =>
      getMetaLandingUrlsByCampaignMap()
    )
)
