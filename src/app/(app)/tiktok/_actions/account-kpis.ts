"use server"

import { createServerAction } from "@/lib/server-action"
import { getTikTokAccountKpis } from "@/lib/services/tiktok/account-kpis"
import type { AccountKpis, DateRange } from "@/lib/services/meta/types"

export const getTikTokAccountKpisSummary = createServerAction(
  async (dateRange: DateRange): Promise<AccountKpis> =>
    getTikTokAccountKpis(dateRange)
)
