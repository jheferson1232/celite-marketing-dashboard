"use server"

import { createServerAction } from "@/lib/server-action"
import { getMetaAudienceBreakdowns } from "@/lib/services/meta/audience-breakdowns"
import type { DateRange } from "@/lib/services/meta/types"

export const getAudienceBreakdownsAction = createServerAction(
  async (dateRange: DateRange) => getMetaAudienceBreakdowns(dateRange)
)
