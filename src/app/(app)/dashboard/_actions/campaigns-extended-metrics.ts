"use server"

import { createServerAction } from "@/lib/server-action"
import {
  getCampaignsExtendedMetrics as getCampaignsExtendedMetricsService,
  type CampaignExtendedMetricsById,
} from "@/lib/services/meta/campaigns-extended-metrics"
import { withMetaDashboardAccount } from "@/lib/services/meta/meta-dashboard-account.server"

export const getCampaignsExtendedMetrics = createServerAction(
  async (input?: { accountId?: string }): Promise<CampaignExtendedMetricsById> =>
    withMetaDashboardAccount(input?.accountId, () =>
      getCampaignsExtendedMetricsService()
    )
)
