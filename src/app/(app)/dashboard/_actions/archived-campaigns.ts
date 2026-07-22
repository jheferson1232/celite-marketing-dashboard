"use server"

import { createServerAction } from "@/lib/server-action"
import {
  archiveMetaCampaign,
  listArchivedMetaCampaigns,
  unarchiveMetaCampaign,
} from "@/lib/services/meta/archived-campaigns"

export const listArchivedMetaCampaignsAction = createServerAction(async () =>
  listArchivedMetaCampaigns()
)

export const archiveMetaCampaignAction = createServerAction(
  async (input: { campaignId: string; name: string }) =>
    archiveMetaCampaign(input)
)

export const unarchiveMetaCampaignAction = createServerAction(
  async (campaignId: string) => unarchiveMetaCampaign(campaignId)
)
