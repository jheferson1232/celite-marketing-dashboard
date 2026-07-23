"use server"

import { createServerAction } from "@/lib/server-action"
import {
  listMetaCampaignOrigins,
  setMetaCampaignOrigin,
} from "@/lib/services/meta/campaign-origin"
import type { CampaignOriginValue } from "@/lib/services/campaign-origin.shared"

export const listMetaCampaignOriginsAction = createServerAction(async () =>
  listMetaCampaignOrigins()
)

export const setMetaCampaignOriginAction = createServerAction(
  async (input: {
    campaignId: string
    origin: CampaignOriginValue | null
  }) => setMetaCampaignOrigin(input)
)
