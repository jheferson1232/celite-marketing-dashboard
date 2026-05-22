import { getMetaClient } from "./meta"
import { withMetaCache } from "./meta-cache"
import { getCachedMetaAdsLandingCatalog } from "./ads-landing-catalog"
import { collectMetaLandingUrlsByCampaign } from "./collect-meta-landing-urls-by-campaign"

const MAP_TTL_MS = 15 * 60 * 1000

export type MetaLandingUrlsByCampaignId = Record<string, string[]>

/** Mapa campaña → URLs (carga aparte de la tabla para no bloquear el catálogo). */
export async function getMetaLandingUrlsByCampaignMap(): Promise<MetaLandingUrlsByCampaignId> {
  return withMetaCache("meta:landing-urls-map:v1", MAP_TTL_MS, async () => {
    const api = getMetaClient()
    const ads = await getCachedMetaAdsLandingCatalog(api)
    const byCampaign = collectMetaLandingUrlsByCampaign(ads)
    const result: MetaLandingUrlsByCampaignId = {}
    for (const [campaignId, urls] of byCampaign) {
      result[campaignId] = urls
    }
    return result
  })
}
