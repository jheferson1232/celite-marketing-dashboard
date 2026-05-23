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

type AdGroupMetricsBundle = {
  period: Map<string, Record<string, string>>
  last7d: Map<string, Record<string, string>>
  total: Map<string, Record<string, string>>
}

function mapTikTokAdGroupToRow(
  adGroup: TikTokAdGroup,
  metrics: AdGroupMetricsBundle
): CampaignAdSetRow {
  const periodMetrics = metrics.period.get(adGroup.adgroup_id) ?? {}
  const spend = getMetricNumber(periodMetrics, "spend")
  const purchases = getPurchases(periodMetrics)
  const purchaseValue = getPurchaseValue(periodMetrics)
  const last7d = getPurchaseSpendAndCpa(metrics.last7d.get(adGroup.adgroup_id) ?? {})
  const totals = getPurchaseSpendAndCpa(metrics.total.get(adGroup.adgroup_id) ?? {})

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
    impressions: getMetricNumber(periodMetrics, "impressions"),
    ctr: getMetricNumber(periodMetrics, "ctr"),
    cpc: getMetricNumber(periodMetrics, "cpc"),
    results: purchases,
    costPerResult: purchases > 0 ? spend / purchases : 0,
    roas: spend > 0 ? purchaseValue / spend : 0,
    purchases7d: last7d.purchases,
    cpa7d: last7d.cpa,
    totalPurchases: totals.purchases,
    totalCpa: totals.cpa,
  }
}

async function fetchTikTokAdGroupMetricsBundle(
  dateRange: DateRange
): Promise<AdGroupMetricsBundle> {
  const range7d = getLastSevenDaysRange()
  const rangeTotal = getTikTokLifetimeDateRange()

  const [period, last7d, total] = await Promise.all([
    fetchCachedAdGroupMetricsByDateRange(dateRange),
    fetchCachedAdGroupMetricsByDateRange(range7d),
    fetchCachedAdGroupMetricsByDateRange(rangeTotal),
  ])

  return { period, last7d, total }
}

/** Todos los conjuntos de la cuenta agrupados por campaignId (filtros excelente/en curso/crítico). */
export async function getTikTokAdSetsGroupedByCampaign(
  dateRange: DateRange
): Promise<Record<string, CampaignAdSetRow[]>> {
  const [adGroups, metrics] = await Promise.all([
    fetchAllPages<TikTokAdGroup>("/adgroup/get/"),
    fetchTikTokAdGroupMetricsBundle(dateRange),
  ])

  const grouped: Record<string, CampaignAdSetRow[]> = {}

  for (const adGroup of adGroups) {
    const row = mapTikTokAdGroupToRow(adGroup, metrics)
    const campaignId = row.campaignId
    if (!grouped[campaignId]) {
      grouped[campaignId] = []
    }
    grouped[campaignId].push(row)
  }

  for (const campaignId of Object.keys(grouped)) {
    grouped[campaignId].sort((a, b) => b.spend - a.spend)
  }

  return grouped
}

export async function getTikTokCampaignAdGroupsByCampaignId(
  campaignId: string,
  dateRange: DateRange
): Promise<CampaignAdSetRow[]> {
  const [adGroups, metrics] = await Promise.all([
    fetchAllPages<TikTokAdGroup>("/adgroup/get/", {
      filtering: JSON.stringify({
        campaign_ids: [campaignId],
      }),
    }),
    fetchTikTokAdGroupMetricsBundle(dateRange),
  ])

  return adGroups
    .map((adGroup) => mapTikTokAdGroupToRow(adGroup, metrics))
    .sort((a, b) => b.spend - a.spend)
}
