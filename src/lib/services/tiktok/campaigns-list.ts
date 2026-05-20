import type { CampaignRow, DateRange } from "@/lib/services/meta/types"
import {
  CAMPAIGN_METRICS,
  fetchIntegratedReport,
  getAddToCart,
  getMetricNumber,
  getPurchases,
  getPurchaseValue,
} from "./report"
import { fetchAllPages } from "./fetch-all-pages"
import { withTikTokCache } from "./tiktok-cache"
import { isTikTokEditableDailyBudget } from "./budget-mode"
import type { TikTokAdGroup, TikTokCampaign } from "./types"

const CAMPAIGNS_TTL_MS = 2 * 60 * 1000

function normalizeStatus(status?: string): CampaignRow["status"] {
  if (status === "ENABLE" || status === "ACTIVE") return "ACTIVE"
  if (status === "DISABLE" || status === "PAUSED") return "PAUSED"
  if (status === "DELETE" || status === "DELETED") return "DELETED"
  return "UNKNOWN"
}

export async function getTikTokCampaignsList(
  dateRange: DateRange
): Promise<CampaignRow[]> {
  const cacheKey = `tiktok-campaigns:${dateRange.from}:${dateRange.to}`
  return withTikTokCache(cacheKey, CAMPAIGNS_TTL_MS, () =>
    fetchTikTokCampaignsList(dateRange)
  )
}

async function fetchTikTokCampaignsList(
  dateRange: DateRange
): Promise<CampaignRow[]> {
  const [campaigns, reportRows, adGroups] = await Promise.all([
    fetchAllPages<TikTokCampaign>("campaign/get/"),
    fetchIntegratedReport(
      "AUCTION_CAMPAIGN",
      ["campaign_id"],
      [...CAMPAIGN_METRICS],
      dateRange.from,
      dateRange.to
    ),
    fetchAllPages<TikTokAdGroup>("adgroup/get/"),
  ])

  const metricsByCampaign = new Map(
    reportRows.map((row) => [
      row.dimensions.campaign_id,
      row.metrics,
    ])
  )

  const adGroupsByCampaign = new Map<string, TikTokAdGroup[]>()
  for (const adGroup of adGroups) {
    const list = adGroupsByCampaign.get(adGroup.campaign_id) ?? []
    list.push(adGroup)
    adGroupsByCampaign.set(adGroup.campaign_id, list)
  }

  return campaigns
    .filter(
      (campaign) =>
        campaign.operation_status !== "DELETE" &&
        campaign.operation_status !== "DELETED"
    )
    .map((campaign) => {
      const metrics = metricsByCampaign.get(campaign.campaign_id) ?? {}
      const spend = getMetricNumber(metrics, "spend")
      const purchases = getPurchases(metrics)
      const purchaseValue = getPurchaseValue(metrics)
      const campaignAdGroups =
        adGroupsByCampaign.get(campaign.campaign_id) ?? []

      const operationStatus =
        campaign.operation_status === "ENABLE" ? "ENABLE" : "DISABLE"

      return {
        id: campaign.campaign_id,
        name: campaign.campaign_name || "Sin nombre",
        status:
          campaignAdGroups.length === 0
            ? normalizeStatus(campaign.operation_status)
            : campaignAdGroups.some(
                (group) => group.operation_status === "ENABLE"
              )
              ? "ACTIVE"
              : "PAUSED",
        operationStatus,
        dailyBudget: isTikTokEditableDailyBudget(campaign.budget_mode)
          ? (campaign.budget ?? 0)
          : null,
        budgetMode: campaign.budget_mode ?? null,
        adGroupDailyBudgetSum: campaignAdGroups
          .filter((g) => isTikTokEditableDailyBudget(g.budget_mode))
          .reduce((sum, g) => sum + (g.budget ?? 0), 0),
        spend,
        impressions: getMetricNumber(metrics, "impressions"),
        adSetsCount: campaignAdGroups.length,
        activeAdsCount: campaignAdGroups.filter(
          (group) => group.operation_status === "ENABLE"
        ).length,
        ctr: getMetricNumber(metrics, "ctr"),
        cpc: getMetricNumber(metrics, "cpc"),
        results: purchases,
        costPerResult: purchases > 0 ? spend / purchases : 0,
        roas: spend > 0 ? purchaseValue / spend : 0,
        addToCart: getAddToCart(metrics),
        objective: campaign.objective_type || "PURCHASE",
      } satisfies CampaignRow
    })
    .sort((a, b) => b.spend - a.spend || a.name.localeCompare(b.name))
}
