import { OBJECTIVE_TO_ACTION_TYPE } from "./objective"
import { getMetaClient } from "./meta"
import type {
  CampaignAdSetRow,
  CampaignEntityStatus,
  DateRange,
  MetaAdSetResponse,
  MetaInsightRow,
  MetaInsightsResponse,
} from "./types"

function normalizeAdSetStatus(status?: string): CampaignEntityStatus {
  if (
    status === "ACTIVE" ||
    status === "PAUSED" ||
    status === "ARCHIVED" ||
    status === "DELETED"
  ) {
    return status
  }

  return "UNKNOWN"
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
    }
  }

  const results =
    insight.actions?.find((action) => action.action_type === actionType)?.value ||
    "0"
  const costPerResult =
    insight.cost_per_action_type?.find(
      (action) => action.action_type === actionType
    )?.value || "0"
  const roasValue =
    insight.action_values?.find((action) => action.action_type === actionType)
      ?.value || "0"
  const spend = parseFloat(insight.spend || "0")

  return {
    spend,
    impressions: parseInt(insight.impressions || "0", 10),
    ctr: parseFloat(insight.ctr || "0"),
    cpc: parseFloat(insight.cpc || "0"),
    results: parseInt(results, 10),
    costPerResult: parseFloat(costPerResult),
    roas: spend > 0 ? parseFloat(roasValue) / spend : 0,
  }
}

export async function getCampaignAdSetsByCampaignId(
  campaignId: string,
  dateRange: DateRange,
  objective: string
): Promise<CampaignAdSetRow[]> {
  const api = getMetaClient()
  const timeRange = JSON.stringify({
    since: dateRange.from,
    until: dateRange.to,
  })
  const campaignFilter = JSON.stringify([
    {
      field: "campaign.id",
      operator: "EQUAL",
      value: campaignId,
    },
  ])

  const [insightsRes, adsetsRes] = await Promise.all([
    api.get<MetaInsightsResponse>("/insights", {
      params: {
        level: "adset",
        fields:
          "adset_id,adset_name,spend,impressions,ctr,cpc,actions,cost_per_action_type,action_values",
        filtering: campaignFilter,
        time_range: timeRange,
        limit: 500,
      },
    }),
    api.get<MetaAdSetResponse>("/adsets", {
      params: {
        fields: "id,name,campaign_id,status",
        filtering: campaignFilter,
        limit: 500,
      },
    }),
  ])

  const insightsByAdSetId = new Map(
    insightsRes.data.data
      .filter((insight) => insight.adset_id)
      .map((insight) => [insight.adset_id as string, insight])
  )

  return adsetsRes.data.data.map((adSet) => {
    const adSetId = adSet.id ?? ""
    const insight = insightsByAdSetId.get(adSetId)
    const metrics = mapInsightToMetrics(insight, objective)

    return {
      id: adSetId,
      name: adSet.name ?? insight?.adset_name ?? "Sin nombre",
      status: normalizeAdSetStatus(adSet.status),
      campaignId: adSet.campaign_id,
      ...metrics,
    }
  })
}
