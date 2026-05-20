"use server"

import { createServerAction } from "@/lib/server-action"
import { getTikTokAdInsights } from "@/lib/services/tiktok/ad-insights"
import type { DateRange } from "@/lib/services/meta/types"

export const getTikTokAdInsightsList = createServerAction(
  async (dateRange: DateRange) => getTikTokAdInsights(dateRange)
)
