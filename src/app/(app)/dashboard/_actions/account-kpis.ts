"use server"

import { createServerAction } from "@/lib/server-action"
import { getAccountKpis } from "@/lib/services/meta/account-kpis"
import type { AccountKpis, DateRange } from "@/lib/services/meta/types"

export const getAccountKpisSummary = createServerAction(
  async (dateRange: DateRange): Promise<AccountKpis> => getAccountKpis(dateRange)
)
