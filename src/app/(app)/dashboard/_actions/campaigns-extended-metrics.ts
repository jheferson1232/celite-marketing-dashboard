"use server"

import { createServerAction } from "@/lib/server-action"
import {
  getCampaignsExtendedMetrics as getCampaignsExtendedMetricsService,
  type CampaignExtendedMetricsById,
} from "@/lib/services/meta/campaigns-extended-metrics"

export const getCampaignsExtendedMetrics = createServerAction(
  async (): Promise<CampaignExtendedMetricsById> =>
    getCampaignsExtendedMetricsService()
)
