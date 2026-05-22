import { extractCreativeDestinationUrl } from "./creative-url"

export type MetaAdForLanding = {
  campaign_id?: string
  creative?: Parameters<typeof extractCreativeDestinationUrl>[0]
}

function normalizeUrlKey(url: string): string {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`)
    return `${parsed.hostname}${parsed.pathname}`.toLowerCase()
  } catch {
    return url.trim().toLowerCase()
  }
}

/** URLs de destino únicas por campaña (mismo patrón que TikTok). */
export function collectMetaLandingUrlsByCampaign(
  ads: MetaAdForLanding[]
): Map<string, string[]> {
  const byCampaign = new Map<string, Map<string, string>>()

  for (const ad of ads) {
    const campaignId = ad.campaign_id?.trim()
    if (!campaignId) continue

    const url = extractCreativeDestinationUrl(ad.creative)
    if (!url) continue

    const key = normalizeUrlKey(url)
    if (!key) continue

    let urlMap = byCampaign.get(campaignId)
    if (!urlMap) {
      urlMap = new Map()
      byCampaign.set(campaignId, urlMap)
    }
    if (!urlMap.has(key)) {
      urlMap.set(key, url)
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
