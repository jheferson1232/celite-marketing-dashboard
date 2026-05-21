import type { CampaignRow, DateRange } from "@/lib/services/meta/types"
import {
  CAMPAIGN_METRICS,
  fetchCachedCampaignMetricsByDateRange,
  fetchIntegratedReport,
  getAddToCart,
  getMetricNumber,
  getPurchaseSpendAndCpa,
  getPurchases,
  getPurchaseValue,
  getTikTokLifetimeDateRange,
} from "./report"
import { getLastSevenDaysRange } from "./campaign-daily-insights"
import { collectUniqueLandingUrlsByCampaign } from "./campaign-landing-urls"
import { fetchAllPages } from "./fetch-all-pages"
import { withTikTokCache } from "./tiktok-cache"
import { isTikTokEditableDailyBudget } from "./budget-mode"
import type { TikTokAd, TikTokAdGroup, TikTokCampaign } from "./types"

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
  const lifetimeRange = getTikTokLifetimeDateRange()
  const range7d = getLastSevenDaysRange()

  const [campaigns, reportRows, metrics7d, lifetimeMetrics, adGroups, ads] =
    await Promise.all([
    fetchAllPages<TikTokCampaign>("campaign/get/"),
    fetchIntegratedReport(
      "AUCTION_CAMPAIGN",
      ["campaign_id"],
      [...CAMPAIGN_METRICS],
      dateRange.from,
      dateRange.to
    ),
    fetchCachedCampaignMetricsByDateRange(range7d),
    fetchCachedCampaignMetricsByDateRange(lifetimeRange),
    fetchAllPages<TikTokAdGroup>("adgroup/get/"),
    fetchAllPages<TikTokAd>("/ad/get/"),
  ])

  const landingUrlsByCampaign = collectUniqueLandingUrlsByCampaign(ads)

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
      const last7d = getPurchaseSpendAndCpa(
        metrics7d.get(campaign.campaign_id) ?? {}
      )
      const lifetime = getPurchaseSpendAndCpa(
        lifetimeMetrics.get(campaign.campaign_id) ?? {}
      )
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
        status: normalizeStatus(campaign.operation_status),
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
        purchases7d: last7d.purchases,
        cpa7d: last7d.cpa,
        totalPurchases: lifetime.purchases,
        totalSpend: lifetime.spend,
        totalCpa: lifetime.cpa,
        objective: campaign.objective_type || "PURCHASE",
        landingUrls:
          landingUrlsByCampaign.get(campaign.campaign_id) ?? [],
      } satisfies CampaignRow
    })
    .sort((a, b) => b.spend - a.spend || a.name.localeCompare(b.name))
}
