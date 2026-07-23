import { fetchAllGraphEdgePages } from "./fetch-graph-edge"
import {
  extractCreativeMediaUrls,
  pickDisplayImageUrl,
} from "./creative-media"
import { isMetaRateLimitError } from "./meta-errors"
import { withMetaCache } from "./meta-cache"
import type { MetaAdCreative } from "./types"

const THUMBNAILS_TTL_MS = 30 * 60 * 1000
/** ~50 ads/página × 4 = hasta 200 creativos; evita barrer campañas enormes. */
const MAX_AD_PAGES = 4

/**
 * Solo campos de cover/imagen en el creativo.
 * No pedimos video source ni resolvemos /adimages|/advideos (extra QPS).
 */
const AD_EDGE_FIELDS =
  "id,name,creative{id,thumbnail_url,image_url," +
  "object_story_spec{photo_data{url},video_data{image_url}," +
  "link_data{picture,image_url}}}"

export type MetaCampaignVideoThumbnail = {
  id: string
  name: string
  thumbnailUrl: string
}

type MetaAdThumbRow = {
  id?: string
  name?: string
  creative?: MetaAdCreative
}

async function fetchCampaignVideoThumbnailsUncached(
  campaignId: string
): Promise<MetaCampaignVideoThumbnail[]> {
  let ads: MetaAdThumbRow[] = []

  try {
    ads = await fetchAllGraphEdgePages<MetaAdThumbRow>(
      campaignId,
      "ads",
      {
        fields: AD_EDGE_FIELDS,
        limit: "50",
      },
      { maxPages: MAX_AD_PAGES }
    )
  } catch (error) {
    // Si Meta corta a mitad, devolvemos vacío y la UI ofrece reintentar.
    if (isMetaRateLimitError(error)) throw error
    console.error("Error fetching Meta campaign ad thumbnails:", error)
    throw error
  }

  const byKey = new Map<string, MetaCampaignVideoThumbnail>()

  for (const ad of ads) {
    const creative = ad.creative
    if (!creative) continue

    const media = extractCreativeMediaUrls(creative)
    const thumbnailUrl = pickDisplayImageUrl(
      media.thumbnailUrl,
      media.imageUrl
    )
    if (!thumbnailUrl) continue

    const id = creative.id || ad.id || thumbnailUrl
    if (byKey.has(id)) continue

    byKey.set(id, {
      id,
      name: ad.name?.trim() || `Anuncio ${ad.id ?? id}`,
      thumbnailUrl,
    })
  }

  return [...byKey.values()]
}

/** Miniaturas (covers/imágenes) de creativos de una campaña Meta. */
export async function getMetaCampaignVideoThumbnails(
  campaignId: string
): Promise<MetaCampaignVideoThumbnail[]> {
  const id = campaignId.trim()
  if (!id) return []

  return withMetaCache(
    `meta-campaign-video-thumbs:v2:${id}`,
    THUMBNAILS_TTL_MS,
    () => fetchCampaignVideoThumbnailsUncached(id)
  )
}
