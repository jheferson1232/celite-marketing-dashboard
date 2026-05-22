import type { AxiosInstance } from "axios"
import { fetchAllMetaPages } from "./paginated-fetch"
import { withMetaCache } from "./meta-cache"

type MetaAdIndexRow = {
  id: string
  campaign_id?: string
}

const ADS_INDEX_TTL_MS = 10 * 60 * 1000

/** Índice liviano de anuncios (id + campaña) para filtrar en servidor sin filtering en API. */
export async function getCachedMetaAdsIndex(
  api: AxiosInstance
): Promise<MetaAdIndexRow[]> {
  return withMetaCache("meta:ads:index", ADS_INDEX_TTL_MS, () =>
    fetchAllMetaPages<MetaAdIndexRow>(api, "/ads", {
      fields: "id,campaign_id",
      limit: "500",
    })
  )
}
