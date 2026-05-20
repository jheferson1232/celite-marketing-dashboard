"use server"

import { createServerAction } from "@/lib/server-action"
import { getAdInsights } from "@/lib/services/meta/ad-insights"
import type { DateRange } from "@/lib/services/meta/types"

export const getAdInsightsList = createServerAction(
  async (dateRange: DateRange) => getAdInsights(dateRange)
)
