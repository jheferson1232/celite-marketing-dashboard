"use server"

import { createServerAction } from "@/lib/server-action"
import type { CampaignExtendedMetricsById } from "@/lib/services/meta/campaigns-extended-metrics"
import {
  getMetaCampaignsByIds,
  getMetaExtendedMetricsByIds,
} from "@/lib/services/meta/linked-campaigns"
import type { CampaignRow, DateRange } from "@/lib/services/meta/types"
import { getTikTokCampaignsByIds } from "@/lib/services/tiktok/linked-campaigns"

export const getTikTokLinkedCampaignsAction = createServerAction(
  async (input: {
    campaignIds: string[]
    dateRange: DateRange
  }): Promise<CampaignRow[]> =>
    getTikTokCampaignsByIds(input.campaignIds, input.dateRange)
)

export const getMetaLinkedCampaignsAction = createServerAction(
  async (input: {
    campaignIds: string[]
    dateRange: DateRange
  }): Promise<CampaignRow[]> =>
    getMetaCampaignsByIds(input.campaignIds, input.dateRange)
)

export const getMetaLinkedExtendedMetricsAction = createServerAction(
  async (input: {
    campaignIds: string[]
  }): Promise<CampaignExtendedMetricsById> =>
    getMetaExtendedMetricsByIds(input.campaignIds)
)
