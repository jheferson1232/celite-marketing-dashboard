import type { AxiosInstance } from "axios"
import { extractCreativeDestinationUrl } from "./creative-url"
import { isMetaRateLimitError } from "./meta-errors"
import { fetchUniqueLandingUrlsFromAdIds } from "./fetch-ad-creatives-batch"
import { fetchAllGraphEdgePages } from "./fetch-graph-edge"
import { getCachedCampaignAdIds } from "./campaign-ad-ids"
const CAMPAIGN_AD_CREATIVE_FIELDS =
  "id,creative{link_url,object_url," +
  "object_story_spec{link_data{link,call_to_action{value{link}}}," +
  "video_data{call_to_action{value{link}}},template_data{link}}," +
  "asset_feed_spec{link_urls{website_url}}}"

type CampaignAdWithCreative = {
  id?: string
  creative?: Parameters<typeof extractCreativeDestinationUrl>[0]
}

const MAX_LANDING_AD_PAGES = 3

function collectUrlsFromAds(ads: CampaignAdWithCreative[]): string[] {
  const urlMap = new Map<string, string>()
  for (const ad of ads) {
    const url = extractCreativeDestinationUrl(ad.creative)
    if (url && !urlMap.has(url)) urlMap.set(url, url)
  }
  return [...urlMap.values()].sort((a, b) => a.localeCompare(b))
}

async function fetchLandingUrlsViaCampaignAdsEdge(
  campaignId: string
): Promise<string[]> {
  const ads = await fetchAllGraphEdgePages<CampaignAdWithCreative>(
    campaignId,
    "ads",
    { fields: CAMPAIGN_AD_CREATIVE_FIELDS, limit: "100" },
    { maxPages: MAX_LANDING_AD_PAGES }
  )
  return collectUrlsFromAds(ads)
}

async function fetchLandingUrlsViaBatchFallback(
  campaignId: string
): Promise<string[]> {
  const adIds = await getCachedCampaignAdIds(campaignId)
  if (adIds.length === 0) return []
  return fetchUniqueLandingUrlsFromAdIds(adIds.slice(0, 40))
}

/** URLs de destino únicas de una campaña (cola + pocas llamadas a Graph). */
export async function getMetaCampaignLandingUrls(
  _api: AxiosInstance,
  campaignId: string
): Promise<string[]> {
  try {
    const fromEdge = await fetchLandingUrlsViaCampaignAdsEdge(campaignId)
    if (fromEdge.length > 0) return fromEdge
  } catch (error) {
    console.error("Meta landing URLs (campaign ads edge):", error)
  }

  try {
    return await fetchLandingUrlsViaBatchFallback(campaignId)
  } catch (error) {
    console.error("Meta landing URLs (batch fallback):", error)
    if (isMetaRateLimitError(error)) {
      throw new Error(
        "Límite de Meta. Espera 1–2 minutos e inténtalo de nuevo."
      )
    }
    throw error
  }
}
