import { getAddToCartFromActions } from "./add-to-cart"
import { OBJECTIVE_TO_ACTION_TYPE } from "./objective"
import { getMetaClient } from "./meta"
import { withMetaCache } from "./meta-cache"
import { fetchAllMetaPages } from "./paginated-fetch"
import type {
  CampaignEntityStatus,
  CampaignRow,
  DateRange,
  MetaAdSet,
  MetaCampaign,
  MetaInsightsResponse,
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

export async function getCampaignsList(
  dateRange: DateRange
): Promise<CampaignRow[]> {
  const cacheKey = `campaigns:${dateRange.from}:${dateRange.to}`
  return withMetaCache(cacheKey, CAMPAIGNS_TTL_MS, () =>
    fetchCampaignsList(dateRange)
  )
}

async function fetchCampaignsList(
  dateRange: DateRange
): Promise<CampaignRow[]> {
  const api = getMetaClient()
  const timeRange = JSON.stringify({
    since: dateRange.from,
    until: dateRange.to,
  })

  const [insightsRes, adsets, campaigns] = await Promise.all([
    api.get<MetaInsightsResponse>("/insights", {
      params: {
        level: "campaign",
        fields:
          "campaign_name,campaign_id,objective,spend,impressions,ctr,cpc,actions,cost_per_action_type,action_values",
        time_range: timeRange,
        limit: 500,
      },
    }),
    fetchAllMetaPages<MetaAdSet>(api, "/adsets", {
      fields: "campaign_id,status",
      limit: "500",
    }),
    fetchAllMetaPages<MetaCampaign>(api, "/campaigns", {
      fields: "id,status,effective_status",
      limit: "500",
    }),
  ])

  const insights = insightsRes.data.data

  const adsetsByCampaign = new Map<string, MetaAdSet[]>()
  for (const adset of adsets) {
    const cid = adset.campaign_id
    if (!cid) continue
    const list = adsetsByCampaign.get(cid) ?? []
    list.push(adset)
    adsetsByCampaign.set(cid, list)
  }

  const campaignStatusById = new Map(
    campaigns.map((campaign) => [
      campaign.id,
      normalizeMetaCampaignStatus(
        campaign.effective_status,
        campaign.status
      ),
    ])
  )

  return insights.map((insight) => {
    const campaignId = insight.campaign_id || ""
    const campaignAdsets = adsetsByCampaign.get(campaignId) ?? []

    const objective = insight.objective || ""
    const actionType = OBJECTIVE_TO_ACTION_TYPE[objective] || "omni_purchase"

    const results =
      insight.actions?.find((action) => action.action_type === actionType)
        ?.value || "0"
    const costPerResult =
      insight.cost_per_action_type?.find(
        (action) => action.action_type === actionType
      )?.value || "0"
    const addToCart = getAddToCartFromActions(insight.actions)

    const status: CampaignEntityStatus =
      campaignStatusById.get(campaignId) ??
      (campaignAdsets.length === 0
        ? "UNKNOWN"
        : campaignAdsets.some((adset) => adset.status === "ACTIVE")
          ? "ACTIVE"
          : "PAUSED")

    return {
      id: campaignId,
      name: insight.campaign_name || "Sin nombre",
      status,
      spend: parseFloat(insight.spend),
      impressions: parseInt(insight.impressions, 10),
      adSetsCount: campaignAdsets.length,
      activeAdsCount: campaignAdsets.filter(
        (adset) => adset.status === "ACTIVE"
      ).length,
      ctr: parseFloat(insight.ctr),
      cpc: parseFloat(insight.cpc || "0"),
      results: parseInt(results, 10),
      costPerResult: parseFloat(costPerResult),
      roas: 0,
      addToCart,
      objective,
    }
  })
    .filter(
      (campaign) =>
        campaign.spend > 0 ||
        campaign.impressions > 0 ||
        campaign.results > 0 ||
        (campaign.addToCart ?? 0) > 0
    )
}
