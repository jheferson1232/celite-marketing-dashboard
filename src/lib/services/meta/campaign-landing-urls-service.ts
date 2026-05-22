import { getMetaClient } from "./meta"
import { withMetaCache } from "./meta-cache"
import { getMetaCampaignLandingUrls } from "./campaign-landing-urls"

const LANDING_URLS_TTL_MS = 30 * 60 * 1000

export async function getMetaCampaignLandingUrlsCached(
  campaignId: string
): Promise<string[]> {
  const cacheKey = `campaign-landing-urls:v4:${campaignId}`
  return withMetaCache(cacheKey, LANDING_URLS_TTL_MS, async () => {
    const api = getMetaClient()
    return getMetaCampaignLandingUrls(api, campaignId)
  })
}
