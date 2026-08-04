import type { CampaignRow, DateRange } from "@/lib/services/meta/types"
import { listTikTokAdAccounts } from "./ad-accounts"
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
import { buildTikTokCacheKey } from "./tiktok-api.server"
import { isTikTokEditableDailyBudget } from "./budget-mode"
import { withTikTokDashboardAccount } from "./tiktok-dashboard-account.server"
import { pacedTikTokRequest } from "./tiktok-request-pacing"
import type { TikTokAd, TikTokAdGroup, TikTokCampaign } from "./types"

const CAMPAIGNS_TTL_MS = 2 * 60 * 1000
/** TikTok QPS ~10; no abrir varias cuentas a la vez. */
const ACCOUNT_FETCH_CONCURRENCY = 2
const ACCOUNT_FETCH_RETRIES = 3

function isLikelyTikTokQpsError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.toLowerCase().includes("qps")
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return []
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(items[index])
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  )
  await Promise.all(workers)
  return results
}

function normalizeStatus(status?: string): CampaignRow["status"] {
  if (status === "ENABLE" || status === "ACTIVE") return "ACTIVE"
  if (status === "DISABLE" || status === "PAUSED") return "PAUSED"
  if (status === "DELETE" || status === "DELETED") return "DELETED"
  return "UNKNOWN"
}

export async function getTikTokCampaignsList(
  dateRange: DateRange
): Promise<CampaignRow[]> {
  const cacheKey = await buildTikTokCacheKey(
    `campaigns:${dateRange.from}:${dateRange.to}`
  )
  return withTikTokCache(cacheKey, CAMPAIGNS_TTL_MS, () =>
    fetchTikTokCampaignsList(dateRange)
  )
}

/**
 * Campañas de todas las cuentas activas (vinculación de productos / Resumen).
 * Prefija el nombre con la cuenta cuando hay más de una.
 */
export async function getTikTokCampaignsListAllAccounts(
  dateRange: DateRange
): Promise<CampaignRow[]> {
  const cacheKey = `tiktok:all-accounts:campaigns:${dateRange.from}:${dateRange.to}`
  return withTikTokCache(cacheKey, CAMPAIGNS_TTL_MS, () =>
    fetchTikTokCampaignsListAllAccounts(dateRange)
  )
}

async function fetchTikTokCampaignsListAllAccounts(
  dateRange: DateRange
): Promise<CampaignRow[]> {
  const accounts = await listTikTokAdAccounts()

  if (accounts.length === 0) {
    return getTikTokCampaignsList(dateRange)
  }

  if (accounts.length === 1) {
    return withTikTokDashboardAccount(accounts[0].id, () =>
      getTikTokCampaignsList(dateRange)
    )
  }

  const lists = await mapPool(
    accounts,
    ACCOUNT_FETCH_CONCURRENCY,
    async (account) => {
      try {
        return await fetchAccountCampaignsWithRetry(account.id, dateRange)
      } catch (error) {
        console.warn(
          `[tiktok] No se pudieron listar campañas de ${account.advertiserId} (${account.name}):`,
          error
        )
        return [] as CampaignRow[]
      }
    }
  )

  return lists
    .flat()
    .sort((a, b) => b.spend - a.spend || a.name.localeCompare(b.name, "es"))
}

async function fetchAccountCampaignsWithRetry(
  accountId: string,
  dateRange: DateRange
): Promise<CampaignRow[]> {
  let lastError: unknown
  for (let attempt = 0; attempt < ACCOUNT_FETCH_RETRIES; attempt++) {
    try {
      return await withTikTokDashboardAccount(accountId, () =>
        getTikTokCampaignsList(dateRange)
      )
    } catch (error) {
      lastError = error
      if (attempt < ACCOUNT_FETCH_RETRIES - 1 && isLikelyTikTokQpsError(error)) {
        await sleep(500 * (attempt + 1))
        continue
      }
      throw error
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("No se pudieron listar campañas TikTok")
}

async function fetchTikTokCampaignsList(
  dateRange: DateRange
): Promise<CampaignRow[]> {
  const lifetimeRange = getTikTokLifetimeDateRange()
  const range7d = getLastSevenDaysRange()

  // Serializar vía pacedTikTokRequest: 6 en paralelo superan el QPS (~10).
  const [campaigns, reportRows, metrics7d, lifetimeMetrics, adGroups, ads] =
    await Promise.all([
      pacedTikTokRequest(() => fetchAllPages<TikTokCampaign>("campaign/get/")),
      pacedTikTokRequest(() =>
        fetchIntegratedReport(
          "AUCTION_CAMPAIGN",
          ["campaign_id"],
          [...CAMPAIGN_METRICS],
          dateRange.from,
          dateRange.to
        )
      ),
      pacedTikTokRequest(() => fetchCachedCampaignMetricsByDateRange(range7d)),
      pacedTikTokRequest(() =>
        fetchCachedCampaignMetricsByDateRange(lifetimeRange)
      ),
      pacedTikTokRequest(() => fetchAllPages<TikTokAdGroup>("adgroup/get/")),
      pacedTikTokRequest(() =>
        fetchAllPages<TikTokAd>("/ad/get/", {
          fields: JSON.stringify([
            "ad_id",
            "ad_name",
            "campaign_id",
            "campaign_name",
            "adgroup_id",
            "operation_status",
            "landing_page_url",
            "landing_page_urls",
            "campaign_automation_type",
            "video_id",
            "image_ids",
          ]),
        })
      ),
    ])

  const landingUrlsByCampaign = collectUniqueLandingUrlsByCampaign(ads)

  const metricsByCampaign = new Map(
    reportRows.map((row) => [row.dimensions.campaign_id, row.metrics])
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
        landingUrls: landingUrlsByCampaign.get(campaign.campaign_id) ?? [],
      } satisfies CampaignRow
    })
    .sort((a, b) => b.spend - a.spend || a.name.localeCompare(b.name))
}
