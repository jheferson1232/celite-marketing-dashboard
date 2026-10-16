"use server"

import { createServerAction } from "@/lib/server-action"
import { getMetaAudienceBreakdowns } from "@/lib/services/meta/audience-breakdowns"
import { withMetaDashboardAccount } from "@/lib/services/meta/meta-dashboard-account.server"
import type { DateRange } from "@/lib/services/meta/types"

export const getAudienceBreakdownsAction = createServerAction(
  async (input: DateRange & { accountId?: string }) =>
    withMetaDashboardAccount(input.accountId, () =>
      getMetaAudienceBreakdowns({ from: input.from, to: input.to })
    )
)
