import axios from "axios"
import { withMetaCache } from "./meta-cache"
import { isMetaCampaignActiveForCount } from "./meta-campaign-status"
import { isMetaAdSetActiveForCount } from "./meta-adset-status"

const INFORME_STATUS_TTL_MS = 2 * 60 * 1000

type MetaStatusRow = {
  status?: string
  effective_status?: string
}

async function fetchInformeEntityStatus(
  metaId: string,
  type: "campaign" | "adset"
): Promise<boolean> {
  const token = process.env.META_ACCESS_TOKEN
  if (!token) return false

  const { data } = await axios.get<MetaStatusRow>(
    `https://graph.facebook.com/v25.0/${metaId}`,
    {
      params: {
        access_token: token,
        fields: "status,effective_status",
      },
    }
  )

  if (type === "campaign") {
    return isMetaCampaignActiveForCount(data)
  }

  return isMetaAdSetActiveForCount({
    status: data.status ?? "",
    effective_status: data.effective_status,
  })
}

/** Estado ON/OFF solo para filas del informe; no usa catálogo del dashboard. */
export async function getInformeEntitiesActiveMap(
  entities: { metaId: string; type: string }[]
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>()

  await Promise.all(
    entities.map(async (entity) => {
      const type = entity.type as "campaign" | "adset"
      const cacheKey = `meta-informe:status:${type}:${entity.metaId}`
      const active = await withMetaCache(cacheKey, INFORME_STATUS_TTL_MS, () =>
        fetchInformeEntityStatus(entity.metaId, type)
      )
      map.set(`${entity.type}:${entity.metaId}`, active)
    })
  )

  return map
}
