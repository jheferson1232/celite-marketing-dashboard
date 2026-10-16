"use server"

import { createServerAction } from "@/lib/server-action"
import { withMetaDashboardAccount } from "@/lib/services/meta/meta-dashboard-account.server"
import { getMetaClient } from "@/lib/services/meta/meta"
import {
  getAdsetLastSevenDaysRange,
  getAdsetLifetimeDateRange,
  getCachedMetaAdsetInsights,
} from "@/lib/services/meta/adset-insights-fetch"
import type { DateRange } from "@/lib/services/meta/types"

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Precarga insights de conjuntos (periodo, 7d y total) para expandir sin esperar. */
export const warmMetaAdsetInsightsAction = createServerAction(
  async (input: DateRange & { accountId?: string }) =>
    withMetaDashboardAccount(input.accountId, async () => {
      const dateRange = { from: input.from, to: input.to }
      const api = getMetaClient()
      await getCachedMetaAdsetInsights(api, dateRange)
      await sleep(600)
      await getCachedMetaAdsetInsights(api, getAdsetLastSevenDaysRange())
      await sleep(600)
      await getCachedMetaAdsetInsights(api, getAdsetLifetimeDateRange())
      return { ok: true }
    })
)
