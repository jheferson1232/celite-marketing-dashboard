"use server"

import { createServerAction } from "@/lib/server-action"
import { getTikTokAccountKpis } from "@/lib/services/tiktok/account-kpis"
import { withTikTokDashboardAccount } from "@/lib/services/tiktok/tiktok-dashboard-account.server"
import type { AccountKpis, DateRange } from "@/lib/services/meta/types"

export const getTikTokAccountKpisSummary = createServerAction(
  async (input: { dateRange: DateRange; accountId?: string }): Promise<AccountKpis> =>
    withTikTokDashboardAccount(input.accountId, () =>
      getTikTokAccountKpis(input.dateRange)
    )
)
