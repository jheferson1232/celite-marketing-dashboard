import type { AxiosInstance } from "axios"
import { fetchAllMetaPages } from "./paginated-fetch"
import { withMetaCache } from "./meta-cache"
import type { MetaCampaign } from "./types"

const CATALOG_TTL_MS = 10 * 60 * 1000

/** Catálogo de campañas (todas las no eliminadas; sin filtro que pueda fallar en Meta). */
export async function getCachedMetaCampaignCatalog(
  api: AxiosInstance
): Promise<MetaCampaign[]> {
  return withMetaCache("meta:campaigns:catalog:v3", CATALOG_TTL_MS, async () => {
    try {
      return await fetchAllMetaPages<MetaCampaign>(api, "/campaigns", {
        fields: "id,name,status,effective_status",
        limit: "500",
      })
    } catch (error) {
      console.error("Meta campaign catalog (full fields) failed:", error)
      return fetchAllMetaPages<MetaCampaign>(api, "/campaigns", {
        fields: "id,status,effective_status",
        limit: "500",
      })
    }
  })
}
