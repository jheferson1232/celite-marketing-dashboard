import { listTikTokAdAccounts } from "./ad-accounts"
import { fetchAllPages } from "./fetch-all-pages"
import { withTikTokDashboardAccount } from "./tiktok-dashboard-account.server"
import type { TikTokCampaign } from "./types"

const campaignAccountCache = new Map<string, string>()

async function campaignExistsOnCurrentAccount(
  campaignId: string
): Promise<boolean> {
  const campaigns = await fetchAllPages<TikTokCampaign>("campaign/get/", {
    filtering: JSON.stringify({ campaign_ids: [campaignId] }),
  })
  return campaigns.some((campaign) => campaign.campaign_id === campaignId)
}

/**
 * Ejecuta `fn` con la cuenta TikTok que posee la campaña.
 * En la ficha de producto las campañas pueden ser de otra cuenta que la del dashboard.
 */
export async function withTikTokAccountForCampaign<T>(
  campaignId: string,
  fn: () => Promise<T>
): Promise<T> {
  const cached = campaignAccountCache.get(campaignId)
  if (cached) {
    return withTikTokDashboardAccount(cached, fn)
  }

  if (await campaignExistsOnCurrentAccount(campaignId)) {
    return fn()
  }

  const accounts = await listTikTokAdAccounts()
  for (const account of accounts) {
    const exists = await withTikTokDashboardAccount(account.id, () =>
      campaignExistsOnCurrentAccount(campaignId)
    )
    if (!exists) continue
    campaignAccountCache.set(campaignId, account.id)
    return withTikTokDashboardAccount(account.id, fn)
  }

  throw new Error(
    "No se encontró la campaña en las cuentas TikTok conectadas"
  )
}
