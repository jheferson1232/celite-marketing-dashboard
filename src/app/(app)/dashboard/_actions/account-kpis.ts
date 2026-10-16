"use server"

import { createServerAction } from "@/lib/server-action"
import { getAccountKpis } from "@/lib/services/meta/account-kpis"
import { withMetaDashboardAccount } from "@/lib/services/meta/meta-dashboard-account.server"
import type { AccountKpis, DateRange } from "@/lib/services/meta/types"

export const getAccountKpisSummary = createServerAction(
  async (input: DateRange & { accountId?: string }): Promise<AccountKpis> =>
    withMetaDashboardAccount(input.accountId, () =>
      getAccountKpis({ from: input.from, to: input.to })
    )
)
