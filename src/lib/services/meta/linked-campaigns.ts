import { getAddToCartFromActions } from "./add-to-cart"
import { getCachedCampaignAdSets } from "./adsets-catalog"
import {
  campaignInsightsToMap,
  fetchCampaignInsightsByIds,
} from "./campaign-insights-fetch"
import type { CampaignExtendedMetricsById } from "./campaigns-extended-metrics"
import { addDaysToDateString, getDashboardToday } from "@/lib/date"
import { getLeadsFromActions, getLeadCplFromActions } from "./leads"
import { getMetaClient } from "./meta"
import { countAdSetsForCampaign } from "./meta-adset-count"
import { isMetaAdSetActiveForCount } from "./meta-adset-status"
import { withMetaCache } from "./meta-cache"
import { normalizeMetaId } from "./meta-ids"
import { OBJECTIVE_TO_ACTION_TYPE } from "./objective"
import { fetchAllMetaPages } from "./paginated-fetch"
import {
  getPurchaseSpendAndCpaFromInsight,
  getPurchasesFromInsight,
} from "./purchase-metrics"
import type {
  CampaignEntityStatus,
  CampaignRow,
  DateRange,
  MetaAdSet,
  MetaCampaign,
  MetaInsightRow,
} from "./types"

const LINKED_TTL_MS = 2 * 60 * 1000
const EXTENDED_TTL_MS = 15 * 60 * 1000

function normalizeMetaCampaignStatus(
  effectiveStatus?: string,
  status?: string
): CampaignEntityStatus {
  const raw = (effectiveStatus || status || "").toUpperCase()
  if (raw === "ACTIVE") return "ACTIVE"
  if (raw === "PAUSED") return "PAUSED"
  if (raw === "ARCHIVED") return "ARCHIVED"
  if (raw === "DELETED") return "DELETED"
  return "UNKNOWN"
}

function resolveCampaignStatus(
  campaignStatus: CampaignEntityStatus,
  campaignAdsets: MetaAdSet[]
): CampaignEntityStatus {
  if (campaignStatus !== "UNKNOWN") return campaignStatus
  if (campaignAdsets.length === 0) return "UNKNOWN"
  return campaignAdsets.some(isMetaAdSetActiveForCount) ? "ACTIVE" : "PAUSED"
}

function buildCampaignRow(
  campaignId: string,
  name: string,
  status: CampaignEntityStatus,
  campaignAdsets: MetaAdSet[],
  periodInsight: MetaInsightRow | undefined
): CampaignRow {
  const objective = periodInsight?.objective || ""
  const actionType =
    OBJECTIVE_TO_ACTION_TYPE[objective] || "omni_purchase"
  const resultsRaw =
    periodInsight?.actions?.find((action) => action.action_type === actionType)
      ?.value || "0"
  const costPerResultRaw =
    periodInsight?.cost_per_action_type?.find(
      (action) => action.action_type === actionType
    )?.value || "0"
  const purchases = getPurchasesFromInsight(periodInsight)
  const spend = periodInsight ? parseFloat(periodInsight.spend || "0") : 0
  const leads = getLeadsFromActions(periodInsight?.actions)
  const costPerLead = getLeadCplFromActions(
    periodInsight?.actions,
    periodInsight?.cost_per_action_type,
    spend
  )
  const { total, active } = countAdSetsForCampaign(campaignAdsets)

  return {
    id: campaignId,
    name,
    status,
    spend,
    impressions: periodInsight
      ? parseInt(periodInsight.impressions || "0", 10) || 0
      : 0,
    adSetsCount: total,
    activeAdsCount: active,
    ctr: periodInsight ? parseFloat(periodInsight.ctr || "0") : 0,
    cpc: periodInsight ? parseFloat(periodInsight.cpc || "0") : 0,
    results: purchases > 0 ? purchases : parseInt(resultsRaw, 10) || 0,
    costPerResult:
      purchases > 0 && spend > 0
        ? spend / purchases
        : parseFloat(costPerResultRaw) || 0,
    roas: 0,
    addToCart: getAddToCartFromActions(periodInsight?.actions),
    leads,
    costPerLead,
    objective,
    landingUrls: [],
  }
}

async function fetchAdSetsForLinkedCampaigns(
  campaignIds: string[]
): Promise<Map<string, MetaAdSet[]>> {
  const map = new Map<string, MetaAdSet[]>()
  const concurrency = 4
  for (let i = 0; i < campaignIds.length; i += concurrency) {
    const chunk = campaignIds.slice(i, i + concurrency)
    const entries = await Promise.all(
      chunk.map(async (campaignId) => {
        const adsets = await getCachedCampaignAdSets(campaignId)
        return [campaignId, adsets] as const
      })
    )
    for (const [campaignId, adsets] of entries) {
      map.set(campaignId, adsets)
    }
  }
  return map
}

function getLastSevenDaysRange(): DateRange {
  const to = getDashboardToday()
  return { from: addDaysToDateString(to, -6), to }
}

function getMetaLifetimeDateRange(): DateRange {
  const to = getDashboardToday()
  return { from: addDaysToDateString(to, -364), to }
}

/** Campañas Meta vinculadas: catálogo + insights + conjuntos solo de esos IDs. */
export async function getMetaCampaignsByIds(
  campaignIds: string[],
  dateRange: DateRange
): Promise<CampaignRow[]> {
  const uniqueIds = [
    ...new Set(campaignIds.map(normalizeMetaId).filter(Boolean)),
  ]
  if (uniqueIds.length === 0) return []

  const cacheKey = `meta:linked-campaigns:${uniqueIds.toSorted().join(",")}:${dateRange.from}:${dateRange.to}`
  return withMetaCache(cacheKey, LINKED_TTL_MS, async () => {
    const api = getMetaClient()
    const filtering = JSON.stringify([
      { field: "id", operator: "IN", value: uniqueIds },
    ])

    const [campaigns, periodInsights, adsetsByCampaign] = await Promise.all([
      fetchAllMetaPages<MetaCampaign>(api, "/campaigns", {
        fields: "id,name,status,effective_status",
        filtering,
        limit: "500",
      }),
      fetchCampaignInsightsByIds(api, dateRange, uniqueIds),
      fetchAdSetsForLinkedCampaigns(uniqueIds),
    ])

    const campaignsById = new Map(
      campaigns
        .map((campaign) => {
          const id = normalizeMetaId(campaign.id)
          return id ? ([id, campaign] as const) : null
        })
        .filter((entry): entry is readonly [string, MetaCampaign] =>
          Boolean(entry)
        )
    )
    const insightsById = campaignInsightsToMap(periodInsights)

    return uniqueIds.map((campaignId) => {
      const campaign = campaignsById.get(campaignId)
      const insight = insightsById.get(campaignId)
      const adsets = adsetsByCampaign.get(campaignId) ?? []
      const status = resolveCampaignStatus(
        normalizeMetaCampaignStatus(
          campaign?.effective_status,
          campaign?.status
        ),
        adsets
      )
      return buildCampaignRow(
        campaignId,
        campaign?.name || insight?.campaign_name || `Campaña ${campaignId}`,
        status,
        adsets,
        insight
      )
    })
  })
}

/** 7d + lifetime solo de las campañas vinculadas (no el catálogo entero). */
export async function getMetaExtendedMetricsByIds(
  campaignIds: string[]
): Promise<CampaignExtendedMetricsById> {
  const uniqueIds = [
    ...new Set(campaignIds.map(normalizeMetaId).filter(Boolean)),
  ]
  if (uniqueIds.length === 0) return {}

  const cacheKey = `meta:linked-ext-metrics:${uniqueIds.toSorted().join(",")}:${getDashboardToday()}`
  return withMetaCache(cacheKey, EXTENDED_TTL_MS, async () => {
    const api = getMetaClient()
    const range7d = getLastSevenDaysRange()
    const lifetimeRange = getMetaLifetimeDateRange()

    const [insights7dRows, lifetimeRows] = await Promise.all([
      fetchCampaignInsightsByIds(api, range7d, uniqueIds),
      fetchCampaignInsightsByIds(api, lifetimeRange, uniqueIds),
    ])

    const insights7d = campaignInsightsToMap(insights7dRows)
    const lifetimeInsights = campaignInsightsToMap(lifetimeRows)
    const result: CampaignExtendedMetricsById = {}

    for (const id of uniqueIds) {
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
  })
}
