import {
  getTikTokLandingPageUrl,
  normalizeLandingPageUrlKey,
  resolveTikTokLandingPageUrl,
} from "./landing-page-url"
import type { TikTokAd } from "./types"

/** URLs de destino únicas por campaña (ordenadas), deduplicadas por host + path. */
export function collectUniqueLandingUrlsByCampaign(
  ads: TikTokAd[]
): Map<string, string[]> {
  const byCampaign = new Map<string, Map<string, string>>()

  for (const ad of ads) {
    const campaignId = ad.campaign_id?.trim()
    if (!campaignId) continue

    const template = getTikTokLandingPageUrl(ad)
    const resolved = resolveTikTokLandingPageUrl(template, {
      campaignId,
      campaignName: ad.campaign_name,
      adId: ad.ad_id,
      adgroupId: ad.adgroup_id,
    })
    if (!resolved) continue

    const key = normalizeLandingPageUrlKey(resolved)
    if (!key) continue

    let urlMap = byCampaign.get(campaignId)
    if (!urlMap) {
      urlMap = new Map()
      byCampaign.set(campaignId, urlMap)
    }
    if (!urlMap.has(key)) {
      urlMap.set(key, resolved)
    }
  }

  const result = new Map<string, string[]>()
  for (const [campaignId, urlMap] of byCampaign) {
    result.set(
      campaignId,
      [...urlMap.values()].sort((a, b) => a.localeCompare(b))
    )
  }
  return result
}
