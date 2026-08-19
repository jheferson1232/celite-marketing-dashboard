import { listTikTokAdAccounts } from "./ad-accounts"
import { fetchAllPages } from "./fetch-all-pages"
import { withTikTokDashboardAccount } from "./tiktok-dashboard-account.server"
import type { TikTokAdGroup, TikTokCampaign } from "./types"

const campaignAccountCache = new Map<string, string>()
const adGroupAccountCache = new Map<string, string>()

async function campaignExistsOnCurrentAccount(
  campaignId: string
): Promise<boolean> {
  const campaigns = await fetchAllPages<TikTokCampaign>("campaign/get/", {
    filtering: JSON.stringify({ campaign_ids: [campaignId] }),
  })
  return campaigns.some((campaign) => campaign.campaign_id === campaignId)
}

async function adGroupExistsOnCurrentAccount(
  adgroupId: string
): Promise<boolean> {
  const groups = await fetchAllPages<TikTokAdGroup>("/adgroup/get/", {
    filtering: JSON.stringify({ adgroup_ids: [adgroupId] }),
  })
  return groups.some((group) => group.adgroup_id === adgroupId)
}

async function withResolvedTikTokAccount<T>(
  cache: Map<string, string>,
  entityId: string,
  existsOnCurrentAccount: () => Promise<boolean>,
  fn: () => Promise<T>,
  notFoundMessage: string
): Promise<T> {
  const cached = cache.get(entityId)
  if (cached) {
    return withTikTokDashboardAccount(cached, fn)
  }

  if (await existsOnCurrentAccount()) {
    return fn()
  }

  const accounts = await listTikTokAdAccounts()
  for (const account of accounts) {
    const exists = await withTikTokDashboardAccount(account.id, () =>
      existsOnCurrentAccount()
    )
    if (!exists) continue
    cache.set(entityId, account.id)
    return withTikTokDashboardAccount(account.id, fn)
  }

  throw new Error(notFoundMessage)
}

/**
 * Ejecuta `fn` con la cuenta TikTok que posee la campaña.
 * En la ficha de producto las campañas pueden ser de otra cuenta que la del dashboard.
 */
export async function withTikTokAccountForCampaign<T>(
  campaignId: string,
  fn: () => Promise<T>
): Promise<T> {
  return withResolvedTikTokAccount(
    campaignAccountCache,
    campaignId,
    () => campaignExistsOnCurrentAccount(campaignId),
    fn,
    "No se encontró la campaña en las cuentas TikTok conectadas"
  )
}

export async function withTikTokAccountForAdGroup<T>(
  adgroupId: string,
  fn: () => Promise<T>
): Promise<T> {
  return withResolvedTikTokAccount(
    adGroupAccountCache,
    adgroupId,
    () => adGroupExistsOnCurrentAccount(adgroupId),
    fn,
    "No se encontró el conjunto en las cuentas TikTok conectadas"
  )
}
