"use server"

import { createServerAction } from "@/lib/server-action"
import { getAdInsights } from "@/lib/services/meta/ad-insights"
import { withMetaDashboardAccount } from "@/lib/services/meta/meta-dashboard-account.server"
import type { DateRange } from "@/lib/services/meta/types"

export const getAdInsightsList = createServerAction(
  async (input: DateRange & { accountId?: string }) =>
    withMetaDashboardAccount(input.accountId, () =>
      getAdInsights({ from: input.from, to: input.to })
    )
)
