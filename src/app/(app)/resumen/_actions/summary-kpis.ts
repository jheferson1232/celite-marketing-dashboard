"use server"

import { createServerAction } from "@/lib/server-action"
import {
  getSummaryKpis,
  type SummaryKpis,
} from "@/lib/services/summary/account-summary"
import type { DateRange } from "@/lib/services/meta/types"

export const getSummaryKpisAction = createServerAction(
  async (dateRange: DateRange): Promise<SummaryKpis> =>
    getSummaryKpis(dateRange)
)
