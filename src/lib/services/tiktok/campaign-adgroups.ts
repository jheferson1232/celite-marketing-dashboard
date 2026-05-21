import type {
  CampaignAdSetRow,
  CampaignEntityStatus,
  DateRange,
} from "@/lib/services/meta/types"
import { fetchAllPages } from "./fetch-all-pages"
import { getLastSevenDaysRange } from "./campaign-daily-insights"
import {
  fetchCachedAdGroupMetricsByDateRange,
  getMetricNumber,
  getPurchaseSpendAndCpa,
  getPurchases,
  getPurchaseValue,
  getTikTokLifetimeDateRange,
} from "./report"
import { isTikTokEditableDailyBudget } from "./budget-mode"
import type { TikTokAdGroup } from "./types"

function normalizeStatus(status?: string): CampaignEntityStatus {
  if (status === "ENABLE" || status === "ACTIVE") return "ACTIVE"
  if (status === "DISABLE" || status === "PAUSED") return "PAUSED"
  if (status === "DELETE" || status === "DELETED") return "DELETED"
  return "UNKNOWN"
}

export async function getTikTokCampaignAdGroupsByCampaignId(
  campaignId: string,
  dateRange: DateRange
): Promise<CampaignAdSetRow[]> {
  const range7d = getLastSevenDaysRange()
  const rangeTotal = getTikTokLifetimeDateRange()

  const [adGroups, metricsByAdGroup, metrics7d, metricsTotal] = await Promise.all([
    fetchAllPages<TikTokAdGroup>("/adgroup/get/", {
      filtering: JSON.stringify({
        campaign_ids: [campaignId],
      }),
    }),
    fetchCachedAdGroupMetricsByDateRange(dateRange),
    fetchCachedAdGroupMetricsByDateRange(range7d),
    fetchCachedAdGroupMetricsByDateRange(rangeTotal),
  ])

  return adGroups.map((adGroup) => {
    const metrics = metricsByAdGroup.get(adGroup.adgroup_id) ?? {}
    const spend = getMetricNumber(metrics, "spend")
    const purchases = getPurchases(metrics)
    const purchaseValue = getPurchaseValue(metrics)
    const last7d = getPurchaseSpendAndCpa(
      metrics7d.get(adGroup.adgroup_id) ?? {}
    )
    const totals = getPurchaseSpendAndCpa(
      metricsTotal.get(adGroup.adgroup_id) ?? {}
    )

    return {
      id: adGroup.adgroup_id,
      name: adGroup.adgroup_name || "Sin nombre",
      status: normalizeStatus(adGroup.operation_status),
      campaignId: adGroup.campaign_id,
      dailyBudget: isTikTokEditableDailyBudget(adGroup.budget_mode)
        ? (adGroup.budget ?? 0)
        : null,
      budgetMode: adGroup.budget_mode ?? null,
      campaignAutomationType: adGroup.campaign_automation_type ?? null,
      spend,
      impressions: getMetricNumber(metrics, "impressions"),
      ctr: getMetricNumber(metrics, "ctr"),
      cpc: getMetricNumber(metrics, "cpc"),
      results: purchases,
      costPerResult: purchases > 0 ? spend / purchases : 0,
      roas: spend > 0 ? purchaseValue / spend : 0,
      purchases7d: last7d.purchases,
      cpa7d: last7d.cpa,
      totalPurchases: totals.purchases,
      totalCpa: totals.cpa,
    }
  })
}
