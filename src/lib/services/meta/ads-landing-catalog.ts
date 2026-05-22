import type { AxiosInstance } from "axios"
import { fetchAllMetaPages } from "./paginated-fetch"
import { withMetaCache } from "./meta-cache"
import type { MetaAdForLanding } from "./collect-meta-landing-urls-by-campaign"

const LANDING_CATALOG_TTL_MS = 15 * 60 * 1000

const ADS_LANDING_FIELDS =
  "id,campaign_id,creative{link_url," +
  "object_story_spec{link_data{link,call_to_action{value{link}}}," +
  "video_data{call_to_action{value{link}}},template_data{link}}}"

/** Todos los anuncios con creativo (una paginación cacheada, como ads en TikTok). */
export async function getCachedMetaAdsLandingCatalog(
  api: AxiosInstance
): Promise<MetaAdForLanding[]> {
  return withMetaCache("meta:ads:landing-catalog:v2", LANDING_CATALOG_TTL_MS, () =>
    fetchAllMetaPages<MetaAdForLanding>(
      api,
      "/ads",
      { fields: ADS_LANDING_FIELDS, limit: "100" },
      { maxPages: 40 }
    )
  )
}
