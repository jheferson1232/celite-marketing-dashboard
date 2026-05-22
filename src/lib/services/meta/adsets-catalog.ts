import type { AxiosInstance } from "axios"
import { fetchAllGraphEdgePages } from "./fetch-graph-edge"
import { fetchAllMetaPages } from "./paginated-fetch"
import { buildAdsetsByCampaignId } from "./meta-adset-count"
import { normalizeMetaId } from "./meta-ids"
import { withMetaCache } from "./meta-cache"
import type { MetaAdSet } from "./types"

const ADSETS_CATALOG_TTL_MS = 10 * 60 * 1000
const CAMPAIGN_EDGE_TTL_MS = 10 * 60 * 1000
const EDGE_SUPPLEMENT_CONCURRENCY = 6

const ADSET_FIELDS = "id,name,campaign_id,status,effective_status"

type AdSetApiRow = MetaAdSet & {
  campaign_id?: string | { id?: string }
}

export function extractAdSetCampaignId(
  adset: AdSetApiRow
): string {
  const raw = adset.campaign_id
  if (raw && typeof raw === "object" && "id" in raw) {
    return normalizeMetaId((raw as { id?: string }).id)
  }
  return normalizeMetaId(raw)
}

export function normalizeAdSetFromApi(adset: AdSetApiRow): MetaAdSet | null {
  const id = normalizeMetaId(adset.id)
  const campaignId = extractAdSetCampaignId(adset)
  if (!id || !campaignId) return null

  return {
    id,
    name: adset.name,
    campaign_id: campaignId,
    status: adset.status ?? "",
    effective_status: adset.effective_status,
  }
}

/** Catálogo global de conjuntos (cuenta). */
export async function getCachedMetaAdsetsCatalog(
  api: AxiosInstance
): Promise<MetaAdSet[]> {
  return withMetaCache("meta:adsets:catalog:v5", ADSETS_CATALOG_TTL_MS, async () => {
    const rows = await fetchAllMetaPages<AdSetApiRow>(api, "/adsets", {
      fields: ADSET_FIELDS,
      limit: "500",
    })
    return rows
      .map(normalizeAdSetFromApi)
      .filter((adset): adset is MetaAdSet => adset !== null)
  })
}

/** Todos los conjuntos de una campaña (fuente fiable para conteos y expandir fila). */
export async function fetchAdSetsForCampaignEdge(
  campaignId: string
): Promise<MetaAdSet[]> {
  const normalizedCampaignId = normalizeMetaId(campaignId)
  if (!normalizedCampaignId) return []

  const rows = await fetchAllGraphEdgePages<AdSetApiRow>(
    normalizedCampaignId,
    "adsets",
    { fields: ADSET_FIELDS, limit: "500" }
  )

  return rows
    .map((row) => {
      const adset = normalizeAdSetFromApi(row)
      if (!adset) return null
      return { ...adset, campaign_id: normalizedCampaignId }
    })
    .filter((adset): adset is MetaAdSet => adset !== null)
}

export async function getCachedCampaignAdSets(
  campaignId: string
): Promise<MetaAdSet[]> {
  const id = normalizeMetaId(campaignId)
  return withMetaCache(
    `meta:campaign-adsets-edge:v1:${id}`,
    CAMPAIGN_EDGE_TTL_MS,
    () => fetchAdSetsForCampaignEdge(id)
  )
}

async function supplementZeroCountCampaigns(
  map: Map<string, MetaAdSet[]>,
  campaignIds: string[]
): Promise<Map<string, MetaAdSet[]>> {
  const missing = campaignIds.filter((id) => (map.get(id)?.length ?? 0) === 0)
  if (missing.length === 0) return map

  const result = new Map(map)

  for (let i = 0; i < missing.length; i += EDGE_SUPPLEMENT_CONCURRENCY) {
    const chunk = missing.slice(i, i + EDGE_SUPPLEMENT_CONCURRENCY)
    const settled = await Promise.allSettled(
      chunk.map(async (campaignId) => ({
        campaignId,
        adsets: await getCachedCampaignAdSets(campaignId),
      }))
    )

    for (const outcome of settled) {
      if (outcome.status !== "fulfilled") continue
      const { campaignId, adsets } = outcome.value
      if (adsets.length > 0) {
        result.set(campaignId, adsets)
      }
    }
  }

  return result
}

/**
 * Mapa campaña → conjuntos: catálogo global + edge por campaña cuando el global devuelve 0.
 */
export async function getAdsetsByCampaignMap(
  api: AxiosInstance,
  campaignIds: string[]
): Promise<Map<string, MetaAdSet[]>> {
  const catalog = await getCachedMetaAdsetsCatalog(api)
  const map = buildAdsetsByCampaignId(catalog)
  const uniqueIds = [
    ...new Set(campaignIds.map(normalizeMetaId).filter(Boolean)),
  ]
  return supplementZeroCountCampaigns(map, uniqueIds)
}
