"use server"

import { createServerAction } from "@/lib/server-action"
import { getCampaignsList as getCampaignsListService } from "@/lib/services/meta/campaigns-list"
import { withMetaDashboardAccount } from "@/lib/services/meta/meta-dashboard-account.server"
import type { CampaignRow, DateRange } from "@/lib/services/meta/types"

export const getCampaignsList = createServerAction(
  async (input: DateRange & { accountId?: string }): Promise<CampaignRow[]> =>
    withMetaDashboardAccount(input.accountId, () =>
      getCampaignsListService({ from: input.from, to: input.to })
    )
)
