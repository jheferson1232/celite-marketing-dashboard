"use server"

import { createServerAction } from "@/lib/server-action"
import { getTikTokAdInsights } from "@/lib/services/tiktok/ad-insights"
import { withTikTokDashboardAccount } from "@/lib/services/tiktok/tiktok-dashboard-account.server"
import type { DateRange } from "@/lib/services/meta/types"

export const getTikTokAdInsightsList = createServerAction(
  async (input: { dateRange: DateRange; accountId?: string }) =>
    withTikTokDashboardAccount(input.accountId, () =>
      getTikTokAdInsights(input.dateRange)
    )
)
