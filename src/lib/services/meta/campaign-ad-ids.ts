import { fetchAllGraphEdgePages } from "./fetch-graph-edge"
import { withMetaCache } from "./meta-cache"

const CAMPAIGN_AD_IDS_TTL_MS = 30 * 60 * 1000

type MetaAdIdRow = { id: string }

/** IDs de anuncios de una sola campaña (evita descargar todo el act_). */
export async function getCachedCampaignAdIds(
  campaignId: string
): Promise<string[]> {
  const cacheKey = `campaign-ad-ids:${campaignId}`
  return withMetaCache(cacheKey, CAMPAIGN_AD_IDS_TTL_MS, async () => {
    const rows = await fetchAllGraphEdgePages<MetaAdIdRow>(campaignId, "ads", {
      fields: "id",
      limit: "500",
    })
    return rows.map((row) => row.id).filter(Boolean)
  })
}
