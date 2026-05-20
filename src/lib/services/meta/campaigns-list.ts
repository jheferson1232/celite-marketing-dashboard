import { OBJECTIVE_TO_ACTION_TYPE } from "./objective"
import { getMetaClient } from "./meta"
import { withMetaCache } from "./meta-cache"
import type {
  CampaignRow,
  DateRange,
  MetaAdResponse,
  MetaAdSetResponse,
  MetaInsightsResponse,
} from "./types"

const CAMPAIGNS_TTL_MS = 2 * 60 * 1000

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

  const [insightsRes, adsetsRes, adsRes] = await Promise.all([
    api.get<MetaInsightsResponse>("/insights", {
      params: {
        level: "campaign",
        fields:
          "campaign_name,campaign_id,objective,spend,impressions,ctr,cpc,actions,cost_per_action_type,action_values",
        time_range: timeRange,
        limit: 500,
      },
    }),
    api.get<MetaAdSetResponse>("/adsets", {
      params: {
        fields: "campaign_id,status",
        limit: 500,
      },
    }),
    api.get<MetaAdResponse>("/ads", {
      params: {
        fields: "campaign_id,effective_status",
        effective_status: '["ACTIVE"]',
        limit: 500,
      },
    }),
  ])

  const insights = insightsRes.data.data
  const adsets = adsetsRes.data.data
  const ads = adsRes.data.data

  return insights.map((insight) => {
    const campaignId = insight.campaign_id || ""
    const campaignAdsets = adsets.filter(
      (adset) => adset.campaign_id === campaignId
    )
    const campaignActiveAds = ads.filter(
      (ad) => ad.campaign_id === campaignId
    )

    const objective = insight.objective || ""
    const actionType = OBJECTIVE_TO_ACTION_TYPE[objective] || "omni_purchase"

    const results =
      insight.actions?.find((action) => action.action_type === actionType)
        ?.value || "0"
    const costPerResult =
      insight.cost_per_action_type?.find(
        (action) => action.action_type === actionType
      )?.value || "0"
    const roas =
      insight.action_values?.find(
        (action) => action.action_type === actionType
      )?.value || "0"

    return {
      id: campaignId,
      name: insight.campaign_name || "Sin nombre",
      status:
        campaignAdsets.length === 0
          ? "UNKNOWN"
          : campaignAdsets.some((adset) => adset.status === "ACTIVE")
            ? "ACTIVE"
            : "PAUSED",
      spend: parseFloat(insight.spend),
      impressions: parseInt(insight.impressions, 10),
      adSetsCount: campaignAdsets.length,
      activeAdsCount: campaignActiveAds.length,
      ctr: parseFloat(insight.ctr),
      cpc: parseFloat(insight.cpc || "0"),
      results: parseInt(results, 10),
      costPerResult: parseFloat(costPerResult),
      roas: parseFloat(roas) / parseFloat(insight.spend || "1"),
      objective,
    }
  })
}
