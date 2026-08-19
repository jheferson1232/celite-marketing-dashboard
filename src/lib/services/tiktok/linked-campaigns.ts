import type { CampaignRow, DateRange } from "@/lib/services/meta/types"
import { convertToCopIfPen } from "@/lib/format/pen-to-cop"
import { listTikTokAdAccounts } from "./ad-accounts"
import { isTikTokEditableDailyBudget } from "./budget-mode"
import { getLastSevenDaysRange } from "./campaign-daily-insights.shared"
import { fetchAllPages } from "./fetch-all-pages"
import {
  CAMPAIGN_METRICS,
  fetchIntegratedReport,
  getAddToCart,
  getMetricNumber,
  getPurchaseSpendAndCpa,
  getPurchases,
  getPurchaseValue,
  getTikTokLifetimeDateRange,
} from "./report"
import { withTikTokCache } from "./tiktok-cache"
import { withTikTokDashboardAccount } from "./tiktok-dashboard-account.server"
import { pacedTikTokRequest } from "./tiktok-request-pacing"
import type { TikTokAdGroup, TikTokCampaign } from "./types"

const LINKED_TTL_MS = 2 * 60 * 1000
const ADGROUP_LIST_FIELDS = JSON.stringify([
  "adgroup_id",
  "adgroup_name",
  "campaign_id",
  "operation_status",
  "budget",
  "budget_mode",
  "campaign_automation_type",
])

function campaignReportFiltering(campaignIds: string[]): string {
  return JSON.stringify([
    {
      field_name: "campaign_ids",
      filter_type: "IN",
      filter_value: JSON.stringify(campaignIds),
    },
  ])
}

function normalizeStatus(status?: string): CampaignRow["status"] {
  if (status === "ENABLE" || status === "ACTIVE") return "ACTIVE"
  if (status === "DISABLE" || status === "PAUSED") return "PAUSED"
  if (status === "DELETE" || status === "DELETED") return "DELETED"
  return "UNKNOWN"
}

function mapCampaignToRow(
  campaign: TikTokCampaign,
  periodMetrics: Record<string, string>,
  metrics7d: Record<string, string>,
  lifetimeMetrics: Record<string, string>,
  campaignAdGroups: TikTokAdGroup[],
  tiktokAccountId?: string,
  accountCurrency?: string | null
): CampaignRow {
  const last7d = getPurchaseSpendAndCpa(metrics7d)
  const lifetime = getPurchaseSpendAndCpa(lifetimeMetrics)
  const spendNative = getMetricNumber(periodMetrics, "spend")
  const purchases = getPurchases(periodMetrics)
  const purchaseValue = getPurchaseValue(periodMetrics)
  const spend = convertToCopIfPen(spendNative, accountCurrency)
  const totalSpend = convertToCopIfPen(lifetime.spend, accountCurrency)
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
    impressions: getMetricNumber(periodMetrics, "impressions"),
    adSetsCount: campaignAdGroups.length,
    activeAdsCount: campaignAdGroups.filter(
      (group) => group.operation_status === "ENABLE"
    ).length,
    ctr: getMetricNumber(periodMetrics, "ctr"),
    cpc: getMetricNumber(periodMetrics, "cpc"),
    results: purchases,
    costPerResult: purchases > 0 ? spend / purchases : 0,
    roas: spendNative > 0 ? purchaseValue / spendNative : 0,
    addToCart: getAddToCart(periodMetrics),
    purchases7d: last7d.purchases,
    cpa7d: convertToCopIfPen(last7d.cpa, accountCurrency),
    totalPurchases: lifetime.purchases,
    totalSpend,
    totalCpa: lifetime.purchases > 0 ? totalSpend / lifetime.purchases : 0,
    objective: campaign.objective_type || "PURCHASE",
    landingUrls: [],
    tiktokAccountId,
  }
}

async function fetchFilteredCampaignMetrics(
  campaignIds: string[],
  dateRange: DateRange
): Promise<Map<string, Record<string, string>>> {
  const rows = await fetchIntegratedReport(
    "AUCTION_CAMPAIGN",
    ["campaign_id"],
    [...CAMPAIGN_METRICS],
    dateRange.from,
    dateRange.to,
    { filtering: campaignReportFiltering(campaignIds) }
  )
  return new Map(
    rows.map((row) => [row.dimensions.campaign_id, row.metrics] as const)
  )
}

async function fetchTikTokCampaignsByIdsForAccount(
  campaignIds: string[],
  dateRange: DateRange,
  tiktokAccountId?: string,
  accountCurrency?: string | null
): Promise<CampaignRow[]> {
  const campaigns = await pacedTikTokRequest(() =>
    fetchAllPages<TikTokCampaign>("campaign/get/", {
      filtering: JSON.stringify({ campaign_ids: campaignIds }),
    })
  )

  const found = campaigns.filter(
    (campaign) =>
      campaign.operation_status !== "DELETE" &&
      campaign.operation_status !== "DELETED" &&
      campaignIds.includes(campaign.campaign_id)
  )
  if (found.length === 0) return []

  const foundIds = found.map((campaign) => campaign.campaign_id)
  const range7d = getLastSevenDaysRange()
  const lifetimeRange = getTikTokLifetimeDateRange()

  const [reportRows, metrics7d, lifetimeMetrics, adGroups] = await Promise.all([
    pacedTikTokRequest(() =>
      fetchFilteredCampaignMetrics(foundIds, dateRange)
    ),
    pacedTikTokRequest(() =>
      fetchFilteredCampaignMetrics(foundIds, range7d)
    ),
    pacedTikTokRequest(() =>
      fetchFilteredCampaignMetrics(foundIds, lifetimeRange)
    ),
    pacedTikTokRequest(() =>
      fetchAllPages<TikTokAdGroup>("adgroup/get/", {
        filtering: JSON.stringify({ campaign_ids: foundIds }),
        fields: ADGROUP_LIST_FIELDS,
      })
    ),
  ])

  const adGroupsByCampaign = new Map<string, TikTokAdGroup[]>()
  for (const adGroup of adGroups) {
    const list = adGroupsByCampaign.get(adGroup.campaign_id) ?? []
    list.push(adGroup)
    adGroupsByCampaign.set(adGroup.campaign_id, list)
  }

  return found.map((campaign) =>
    mapCampaignToRow(
      campaign,
      reportRows.get(campaign.campaign_id) ?? {},
      metrics7d.get(campaign.campaign_id) ?? {},
      lifetimeMetrics.get(campaign.campaign_id) ?? {},
      adGroupsByCampaign.get(campaign.campaign_id) ?? [],
      tiktokAccountId,
      accountCurrency
    )
  )
}

/**
 * Solo las campañas vinculadas, no el catálogo completo de cada cuenta.
 * Si una cuenta no tiene ninguno de los IDs, sale en 1 GET liviano.
 */
export async function getTikTokCampaignsByIds(
  campaignIds: string[],
  dateRange: DateRange
): Promise<CampaignRow[]> {
  const uniqueIds = [...new Set(campaignIds.filter(Boolean))]
  if (uniqueIds.length === 0) return []

  const cacheKey = `tiktok:linked-campaigns:v3-cop:${uniqueIds.toSorted().join(",")}:${dateRange.from}:${dateRange.to}`
  return withTikTokCache(cacheKey, LINKED_TTL_MS, async () => {
    const byId = new Map<string, CampaignRow>()

    async function ingest(
      ids: string[],
      accountId?: string,
      accountCurrency?: string | null
    ): Promise<CampaignRow[]> {
      return fetchTikTokCampaignsByIdsForAccount(
        ids,
        dateRange,
        accountId,
        accountCurrency
      )
    }

    const accounts = await listTikTokAdAccounts()
    const pending = () => uniqueIds.filter((id) => !byId.has(id))

    if (accounts.length === 0) {
      for (const row of await ingest(uniqueIds, undefined, "PEN")) {
        byId.set(row.id, row)
      }
    } else {
      for (const account of accounts) {
        const remaining = pending()
        if (remaining.length === 0) break
        const rows = await withTikTokDashboardAccount(account.id, () =>
          ingest(remaining, account.id, account.currency)
        )
        for (const row of rows) {
          if (!byId.has(row.id)) byId.set(row.id, row)
        }
      }
    }

    return uniqueIds.flatMap((id) => {
      const row = byId.get(id)
      return row ? [row] : []
    })
  })
}
