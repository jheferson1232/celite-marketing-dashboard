import { getAddToCartFromActions } from "./add-to-cart"
import {
  adsetInsightsByCampaignId,
  adsetInsightsToMapByAdSetId,
  getAdsetLastSevenDaysRange,
  getAdsetLifetimeDateRange,
  getCachedMetaAdsetInsights,
} from "./adset-insights-fetch"
import { getCachedCampaignAdSets } from "./adsets-catalog"
import { buildAdsetCatalogById, mergeAdSetsForCampaign } from "./meta-adset-count"
import { normalizeMetaId } from "./meta-ids"
import { isMetaAdSetActiveForCount } from "./meta-adset-status"
import { OBJECTIVE_TO_ACTION_TYPE } from "./objective"
import { getPurchaseSpendAndCpaFromInsight } from "./purchase-metrics"
import { getMetaClient } from "./meta"
import { withMetaCache } from "./meta-cache"
import type {
  CampaignAdSetRow,
  CampaignEntityStatus,
  DateRange,
  MetaAdSet,
  MetaInsightRow,
} from "./types"

const ADSETS_BY_CAMPAIGN_TTL_MS = 2 * 60 * 1000

function resolveAdSetDisplayStatus(adset: MetaAdSet): CampaignEntityStatus {
  if (isMetaAdSetActiveForCount(adset)) return "ACTIVE"

  const status = (adset.status || "").toUpperCase()
  if (status === "PAUSED") return "PAUSED"
  if (status === "ARCHIVED") return "ARCHIVED"
  if (status === "DELETED") return "DELETED"

  return "PAUSED"
}

function mapInsightToMetrics(insight: MetaInsightRow | undefined, objective: string) {
  const actionType = OBJECTIVE_TO_ACTION_TYPE[objective] || "omni_purchase"

  if (!insight) {
    return {
      spend: 0,
      impressions: 0,
      ctr: 0,
      cpc: 0,
      results: 0,
      costPerResult: 0,
      roas: 0,
      addToCart: 0,
    }
  }

  const purchases = getPurchaseSpendAndCpaFromInsight(insight)
  const resultsRaw =
    insight.actions?.find((action) => action.action_type === actionType)
      ?.value || "0"
  const costPerResultRaw =
    insight.cost_per_action_type?.find(
      (action) => action.action_type === actionType
    )?.value || "0"

  return {
    spend: purchases.spend,
    impressions: parseInt(insight.impressions || "0", 10),
    ctr: parseFloat(insight.ctr || "0"),
    cpc: parseFloat(insight.cpc || "0"),
    results:
      purchases.purchases > 0
        ? purchases.purchases
        : parseInt(resultsRaw, 10) || 0,
    costPerResult:
      purchases.purchases > 0
        ? purchases.cpa
        : parseFloat(costPerResultRaw) || 0,
    roas: 0,
    addToCart: getAddToCartFromActions(insight.actions),
  }
}

function buildRowFromAdSet(
  adSet: MetaAdSet,
  periodInsight: MetaInsightRow | undefined,
  insight7d: MetaInsightRow | undefined,
  insightLifetime: MetaInsightRow | undefined,
  objective: string
): CampaignAdSetRow {
  const adSetId = normalizeMetaId(adSet.id)
  const metrics = mapInsightToMetrics(periodInsight, objective)
  const last7d = getPurchaseSpendAndCpaFromInsight(insight7d)
  const lifetime = getPurchaseSpendAndCpaFromInsight(insightLifetime)

  return {
    id: adSetId,
    name: adSet.name ?? periodInsight?.adset_name ?? "Sin nombre",
    status: resolveAdSetDisplayStatus(adSet),
    campaignId: adSet.campaign_id,
    adSetEffectiveStatus: adSet.effective_status,
    ...metrics,
    purchases7d: last7d.purchases,
    cpa7d: last7d.cpa,
    totalPurchases: lifetime.purchases,
    totalSpend: lifetime.spend,
    totalCpa: lifetime.cpa,
  }
}

function buildRowFromInsight(
  insight: MetaInsightRow,
  insight7d: MetaInsightRow | undefined,
  insightLifetime: MetaInsightRow | undefined,
  objective: string
): CampaignAdSetRow | null {
  const adSetId = insight.adset_id?.trim()
  if (!adSetId) return null

  const metrics = mapInsightToMetrics(insight, objective)
  const last7d = getPurchaseSpendAndCpaFromInsight(insight7d)
  const lifetime = getPurchaseSpendAndCpaFromInsight(insightLifetime)

  return {
    id: adSetId,
    name: insight.adset_name ?? "Sin nombre",
    status: "UNKNOWN",
    campaignId: insight.campaign_id ?? "",
    ...metrics,
    purchases7d: last7d.purchases,
    cpa7d: last7d.cpa,
    totalPurchases: lifetime.purchases,
    totalSpend: lifetime.spend,
    totalCpa: lifetime.cpa,
  }
}

async function fetchCampaignAdSetsByCampaignId(
  campaignId: string,
  dateRange: DateRange,
  objective: string
): Promise<CampaignAdSetRow[]> {
  const api = getMetaClient()
  const range7d = getAdsetLastSevenDaysRange()
  const lifetimeRange = getAdsetLifetimeDateRange()

  let catalogAdsets: MetaAdSet[] = []
  try {
    catalogAdsets = await getCachedCampaignAdSets(campaignId)
  } catch (error) {
    console.error("Meta adsets edge for campaign:", error)
  }

  let periodInsights: MetaInsightRow[] = []
  let insights7dAll: MetaInsightRow[] = []
  let insightsLifetimeAll: MetaInsightRow[] = []

  try {
    const [period, last7d, lifetime] = await Promise.all([
      getCachedMetaAdsetInsights(api, dateRange),
      getCachedMetaAdsetInsights(api, range7d),
      getCachedMetaAdsetInsights(api, lifetimeRange),
    ])
    periodInsights = adsetInsightsByCampaignId(period, campaignId)
    insights7dAll = adsetInsightsByCampaignId(last7d, campaignId)
    insightsLifetimeAll = adsetInsightsByCampaignId(lifetime, campaignId)
  } catch (error) {
    console.error("Meta adset insights cache:", error)
  }

  const insightsByAdSetId = adsetInsightsToMapByAdSetId(periodInsights)
  const insights7dByAdSetId = adsetInsightsToMapByAdSetId(insights7dAll)
  const insightsLifetimeByAdSetId =
    adsetInsightsToMapByAdSetId(insightsLifetimeAll)

  const catalogByAdSetId = buildAdsetCatalogById(catalogAdsets)
  const mergedAdsets = mergeAdSetsForCampaign(
    campaignId,
    catalogAdsets,
    periodInsights,
    catalogByAdSetId
  )

  if (mergedAdsets.length > 0) {
    return mergedAdsets.map((adSet) =>
      buildRowFromAdSet(
        adSet,
        insightsByAdSetId.get(normalizeMetaId(adSet.id)),
        insights7dByAdSetId.get(normalizeMetaId(adSet.id)),
        insightsLifetimeByAdSetId.get(normalizeMetaId(adSet.id)),
        objective
      )
    )
  }

  if (periodInsights.length > 0) {
    return periodInsights
      .map((insight) =>
        buildRowFromInsight(
          insight,
          insights7dByAdSetId.get(insight.adset_id ?? ""),
          insightsLifetimeByAdSetId.get(insight.adset_id ?? ""),
          objective
        )
      )
      .filter((row): row is CampaignAdSetRow => row !== null)
  }

  return []
}

export async function getCampaignAdSetsByCampaignId(
  campaignId: string,
  dateRange: DateRange,
  objective: string
): Promise<CampaignAdSetRow[]> {
  const cacheKey = `campaign-adsets:v5:${normalizeMetaId(campaignId)}:${dateRange.from}:${dateRange.to}:${objective}`
  return withMetaCache(cacheKey, ADSETS_BY_CAMPAIGN_TTL_MS, () =>
    fetchCampaignAdSetsByCampaignId(campaignId, dateRange, objective)
  )
}
