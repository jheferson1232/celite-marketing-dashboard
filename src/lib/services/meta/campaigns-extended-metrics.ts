import { addDaysToDateString, getDashboardToday } from "@/lib/date"
import {
  campaignInsightsToMap,
  fetchAllCampaignInsights,
} from "./campaign-insights-fetch"
import { getMetaClient } from "./meta"
import { withMetaCache } from "./meta-cache"
import { runMetaRequestQueued } from "./meta-request-queue"
import { getPurchaseSpendAndCpaFromInsight } from "./purchase-metrics"
import type { DateRange } from "./types"

const EXTENDED_TTL_MS = 15 * 60 * 1000

export type CampaignExtendedMetrics = {
  purchases7d: number
  cpa7d: number
  totalPurchases: number
  totalSpend: number
  totalCpa: number
}

export type CampaignExtendedMetricsById = Record<
  string,
  CampaignExtendedMetrics
>

function getLastSevenDaysRange(): DateRange {
  const to = getDashboardToday()
  return { from: addDaysToDateString(to, -6), to }
}

function getMetaLifetimeDateRange(): DateRange {
  const to = getDashboardToday()
  return { from: addDaysToDateString(to, -364), to }
}

function mapToExtendedMetrics(
  insights7d: ReturnType<typeof campaignInsightsToMap>,
  lifetimeInsights: ReturnType<typeof campaignInsightsToMap>
): CampaignExtendedMetricsById {
  const ids = new Set([
    ...insights7d.keys(),
    ...lifetimeInsights.keys(),
  ])
  const result: CampaignExtendedMetricsById = {}

  for (const id of ids) {
    const last7d = getPurchaseSpendAndCpaFromInsight(insights7d.get(id))
    const lifetime = getPurchaseSpendAndCpaFromInsight(lifetimeInsights.get(id))
    result[id] = {
      purchases7d: last7d.purchases,
      cpa7d: last7d.cpa,
      totalPurchases: lifetime.purchases,
      totalSpend: lifetime.spend,
      totalCpa: lifetime.cpa,
    }
  }

  return result
}

/** Métricas 7d y lifetime; cache largo y peticiones secuenciales para no saturar Meta. */
export async function getCampaignsExtendedMetrics(): Promise<CampaignExtendedMetricsById> {
  const cacheKey = `campaigns-ext-metrics:${getDashboardToday()}`
  return withMetaCache(cacheKey, EXTENDED_TTL_MS, fetchCampaignsExtendedMetrics)
}

async function fetchCampaignsExtendedMetrics(): Promise<CampaignExtendedMetricsById> {
  return runMetaRequestQueued(async () => {
    const api = getMetaClient()
    const range7d = getLastSevenDaysRange()
    const lifetimeRange = getMetaLifetimeDateRange()

    const insights7dRows = await fetchAllCampaignInsights(api, range7d)
    await new Promise((resolve) => setTimeout(resolve, 800))
    const lifetimeRows = await fetchAllCampaignInsights(api, lifetimeRange)

    return mapToExtendedMetrics(
      campaignInsightsToMap(insights7dRows),
      campaignInsightsToMap(lifetimeRows)
    )
  })
}
