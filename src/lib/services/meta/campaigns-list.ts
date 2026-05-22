import { getAdsetsByCampaignMap } from "./adsets-catalog"
import { getAddToCartFromActions } from "./add-to-cart"
import { getCachedMetaCampaignCatalog } from "./campaign-catalog"
import {
  campaignInsightsToMap,
  fetchAllCampaignInsights,
} from "./campaign-insights-fetch"
import {
  buildAdsetCatalogById,
  countAdSetsForCampaign,
  mergeAdSetsForCampaign,
} from "./meta-adset-count"
import { isMetaAdSetActiveForCount } from "./meta-adset-status"
import { normalizeMetaId } from "./meta-ids"
import { OBJECTIVE_TO_ACTION_TYPE } from "./objective"
import { getMetaClient } from "./meta"
import { withMetaCache } from "./meta-cache"
import { getPurchasesFromInsight } from "./purchase-metrics"
import type {
  CampaignEntityStatus,
  CampaignRow,
  DateRange,
  MetaAdSet,
  MetaCampaign,
  MetaInsightRow,
} from "./types"

const CAMPAIGNS_TTL_MS = 2 * 60 * 1000

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
  campaignId: string,
  campaignStatusById: Map<string, CampaignEntityStatus>,
  campaignAdsets: MetaAdSet[]
): CampaignEntityStatus {
  const fromCatalog = campaignStatusById.get(campaignId)
  if (fromCatalog && fromCatalog !== "UNKNOWN") return fromCatalog
  if (campaignAdsets.length === 0) return "UNKNOWN"
  return campaignAdsets.some(isMetaAdSetActiveForCount) ? "ACTIVE" : "PAUSED"
}

function buildPeriodMetrics(insight: MetaInsightRow | undefined, objective: string) {
  if (!insight) {
    return {
      spend: 0,
      impressions: 0,
      ctr: 0,
      cpc: 0,
      results: 0,
      costPerResult: 0,
      addToCart: 0,
      objective: objective || "",
    }
  }

  const resolvedObjective = insight.objective || objective
  const actionType =
    OBJECTIVE_TO_ACTION_TYPE[resolvedObjective] || "omni_purchase"
  const resultsRaw =
    insight.actions?.find((action) => action.action_type === actionType)
      ?.value || "0"
  const costPerResultRaw =
    insight.cost_per_action_type?.find(
      (action) => action.action_type === actionType
    )?.value || "0"

  const purchases = getPurchasesFromInsight(insight)
  const spend = parseFloat(insight.spend || "0")

  return {
    spend,
    impressions: parseInt(insight.impressions || "0", 10) || 0,
    ctr: parseFloat(insight.ctr || "0"),
    cpc: parseFloat(insight.cpc || "0"),
    results: purchases > 0 ? purchases : parseInt(resultsRaw, 10) || 0,
    costPerResult:
      purchases > 0 && spend > 0
        ? spend / purchases
        : parseFloat(costPerResultRaw) || 0,
    addToCart: getAddToCartFromActions(insight.actions),
    objective: resolvedObjective,
  }
}

function buildCampaignRow(
  campaignId: string,
  name: string,
  status: CampaignEntityStatus,
  campaignAdsets: MetaAdSet[],
  catalogByAdSetId: Map<string, MetaAdSet>,
  periodInsight: MetaInsightRow | undefined,
  objectiveFallback: string
): CampaignRow {
  const period = buildPeriodMetrics(periodInsight, objectiveFallback)
  const mergedAdsets = mergeAdSetsForCampaign(
    campaignId,
    campaignAdsets,
    [],
    catalogByAdSetId
  )
  const { total, active } = countAdSetsForCampaign(mergedAdsets)

  return {
    id: campaignId,
    name,
    status,
    spend: period.spend,
    impressions: period.impressions,
    adSetsCount: total,
    activeAdsCount: active,
    ctr: period.ctr,
    cpc: period.cpc,
    results: period.results,
    costPerResult: period.costPerResult,
    roas: 0,
    addToCart: period.addToCart,
    objective: period.objective,
    landingUrls: [],
  }
}

export async function getCampaignsList(
  dateRange: DateRange
): Promise<CampaignRow[]> {
  const cacheKey = `campaigns:v11:${dateRange.from}:${dateRange.to}`
  return withMetaCache(cacheKey, CAMPAIGNS_TTL_MS, () =>
    fetchCampaignsList(dateRange)
  )
}

async function fetchCampaignsList(
  dateRange: DateRange
): Promise<CampaignRow[]> {
  const api = getMetaClient()

  let campaigns: MetaCampaign[] = []

  try {
    campaigns = await getCachedMetaCampaignCatalog(api)
  } catch (error) {
    console.error("Meta campaigns-list (catalog):", error)
  }

  let periodInsights: MetaInsightRow[] = []
  try {
    periodInsights = await fetchAllCampaignInsights(api, dateRange)
  } catch (error) {
    console.error("Meta campaigns-list (insights):", error)
  }

  const catalogCampaigns = campaigns.filter((campaign) => {
    const status = normalizeMetaCampaignStatus(
      campaign.effective_status,
      campaign.status
    )
    return status !== "DELETED" && Boolean(normalizeMetaId(campaign.id))
  })

  const campaignIdsForAdsets = [
    ...new Set([
      ...catalogCampaigns.map((c) => normalizeMetaId(c.id)),
      ...periodInsights
        .map((row) => normalizeMetaId(row.campaign_id))
        .filter(Boolean),
    ]),
  ]

  let adsetsByCampaign = new Map<string, MetaAdSet[]>()
  let catalogByAdSetId = new Map<string, MetaAdSet>()

  try {
    adsetsByCampaign = await getAdsetsByCampaignMap(api, campaignIdsForAdsets)
    const allAdsets = [...adsetsByCampaign.values()].flat()
    catalogByAdSetId = buildAdsetCatalogById(allAdsets)
  } catch (error) {
    console.error("Meta campaigns-list (adsets map):", error)
  }

  const campaignStatusById = new Map(
    campaigns.map((campaign) => [
      normalizeMetaId(campaign.id),
      normalizeMetaCampaignStatus(
        campaign.effective_status,
        campaign.status
      ),
    ])
  )

  const periodInsightsById = campaignInsightsToMap(periodInsights)
  const rowsById = new Map<string, CampaignRow>()

  for (const campaign of catalogCampaigns) {
    const campaignId = normalizeMetaId(campaign.id)
    const campaignAdsets = adsetsByCampaign.get(campaignId) ?? []
    rowsById.set(
      campaignId,
      buildCampaignRow(
        campaignId,
        campaign.name || "Sin nombre",
        resolveCampaignStatus(
          campaignId,
          campaignStatusById,
          mergeAdSetsForCampaign(
            campaignId,
            campaignAdsets,
            [],
            catalogByAdSetId
          )
        ),
        campaignAdsets,
        catalogByAdSetId,
        periodInsightsById.get(campaignId),
        periodInsightsById.get(campaignId)?.objective || ""
      )
    )
  }

  for (const insight of periodInsights) {
    const campaignId = normalizeMetaId(insight.campaign_id)
    if (!campaignId || rowsById.has(campaignId)) continue

    const campaignAdsets = adsetsByCampaign.get(campaignId) ?? []
    rowsById.set(
      campaignId,
      buildCampaignRow(
        campaignId,
        insight.campaign_name || "Sin nombre",
        resolveCampaignStatus(
          campaignId,
          campaignStatusById,
          mergeAdSetsForCampaign(
            campaignId,
            campaignAdsets,
            [],
            catalogByAdSetId
          )
        ),
        campaignAdsets,
        catalogByAdSetId,
        insight,
        insight.objective || ""
      )
    )
  }

  for (const [campaignId, campaignAdsets] of adsetsByCampaign) {
    if (!campaignId || rowsById.has(campaignId)) continue
    rowsById.set(
      campaignId,
      buildCampaignRow(
        campaignId,
        periodInsightsById.get(campaignId)?.campaign_name ||
          `Campaña ${campaignId}`,
        resolveCampaignStatus(
          campaignId,
          campaignStatusById,
          mergeAdSetsForCampaign(
            campaignId,
            campaignAdsets,
            [],
            catalogByAdSetId
          )
        ),
        campaignAdsets,
        catalogByAdSetId,
        periodInsightsById.get(campaignId),
        periodInsightsById.get(campaignId)?.objective || ""
      )
    )
  }

  return [...rowsById.values()].sort(
    (a, b) => b.spend - a.spend || a.name.localeCompare(b.name)
  )
}
