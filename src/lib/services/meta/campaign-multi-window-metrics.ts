import { addDaysToDateString, getDashboardToday, getLastNDaysRange } from "@/lib/date"
import {
  campaignInsightsToMap,
  fetchAllCampaignInsights,
} from "./campaign-insights-fetch"
import { getMetaClient } from "./meta"
import { withMetaCache } from "./meta-cache"
import { normalizeMetaId } from "./meta-ids"
import { runMetaRequestQueued } from "./meta-request-queue"
import { getPurchaseSpendAndCpaFromInsight } from "./purchase-metrics"
import type { DateRange } from "./types"

const MULTI_WINDOW_TTL_MS = 15 * 60 * 1000
const META_FETCH_GAP_MS = 600

export type CampaignWindowMetrics = {
  spend: number
  purchases: number
  cpa: number
}

export type CampaignMultiWindowMetrics = {
  d7: CampaignWindowMetrics
  d15: CampaignWindowMetrics
  d30: CampaignWindowMetrics
  total: CampaignWindowMetrics
}

function windowFromInsight(
  map: ReturnType<typeof campaignInsightsToMap>,
  metaId: string
): CampaignWindowMetrics {
  const m = getPurchaseSpendAndCpaFromInsight(map.get(normalizeMetaId(metaId)))
  return { spend: m.spend, purchases: m.purchases, cpa: m.cpa }
}

function emptyWindows(): CampaignMultiWindowMetrics {
  const empty: CampaignWindowMetrics = { spend: 0, purchases: 0, cpa: 0 }
  return { d7: { ...empty }, d15: { ...empty }, d30: { ...empty }, total: { ...empty } }
}

function buildMetricsMap(
  maps: {
    d7: ReturnType<typeof campaignInsightsToMap>
    d15: ReturnType<typeof campaignInsightsToMap>
    d30: ReturnType<typeof campaignInsightsToMap>
    total: ReturnType<typeof campaignInsightsToMap>
  },
  metaIds: string[]
): Map<string, CampaignMultiWindowMetrics> {
  const result = new Map<string, CampaignMultiWindowMetrics>()
  for (const rawId of metaIds) {
    const id = normalizeMetaId(rawId)
    result.set(id, {
      d7: windowFromInsight(maps.d7, id),
      d15: windowFromInsight(maps.d15, id),
      d30: windowFromInsight(maps.d30, id),
      total: windowFromInsight(maps.total, id),
    })
  }
  return result
}

function getMetaLifetimeDateRange(): DateRange {
  const to = getDashboardToday()
  return { from: addDaysToDateString(to, -364), to }
}

async function fetchAllWindowMaps(): Promise<{
  d7: ReturnType<typeof campaignInsightsToMap>
  d15: ReturnType<typeof campaignInsightsToMap>
  d30: ReturnType<typeof campaignInsightsToMap>
  total: ReturnType<typeof campaignInsightsToMap>
}> {
  return runMetaRequestQueued(async () => {
    const api = getMetaClient()
    const range7 = getLastNDaysRange(7)
    const range15 = getLastNDaysRange(15)
    const range30 = getLastNDaysRange(30)
    const lifetimeRange = getMetaLifetimeDateRange()

    const rows7 = await fetchAllCampaignInsights(api, range7)
    await new Promise((r) => setTimeout(r, META_FETCH_GAP_MS))
    const rows15 = await fetchAllCampaignInsights(api, range15)
    await new Promise((r) => setTimeout(r, META_FETCH_GAP_MS))
    const rows30 = await fetchAllCampaignInsights(api, range30)
    await new Promise((r) => setTimeout(r, META_FETCH_GAP_MS))
    const rowsTotal = await fetchAllCampaignInsights(api, lifetimeRange)

    return {
      d7: campaignInsightsToMap(rows7),
      d15: campaignInsightsToMap(rows15),
      d30: campaignInsightsToMap(rows30),
      total: campaignInsightsToMap(rowsTotal),
    }
  })
}

/** Métricas 7 / 15 / 30 días y total (cuenta) para campañas del informe. */
export async function getCampaignMultiWindowMetricsForMetaIds(
  metaIds: string[]
): Promise<Map<string, CampaignMultiWindowMetrics>> {
  if (metaIds.length === 0) return new Map()

  const cacheKey = `campaign-mw-metrics:${getDashboardToday()}`
  const allMaps = await withMetaCache(cacheKey, MULTI_WINDOW_TTL_MS, fetchAllWindowMaps)
  return buildMetricsMap(allMaps, metaIds)
}

export function getEmptyCampaignMultiWindowMetrics(): CampaignMultiWindowMetrics {
  return emptyWindows()
}
