import { isMetaAdSetActiveForCount } from "./meta-adset-status"
import { normalizeMetaId } from "./meta-ids"
import type { MetaAdSet, MetaInsightRow } from "./types"

export function buildAdsetsByCampaignId(
  adsets: MetaAdSet[]
): Map<string, MetaAdSet[]> {
  const map = new Map<string, MetaAdSet[]>()

  for (const adset of adsets) {
    const campaignId = normalizeMetaId(adset.campaign_id)
    const adsetId = normalizeMetaId(adset.id)
    if (!campaignId || !adsetId) continue

    const list = map.get(campaignId) ?? []
    list.push({
      ...adset,
      id: adsetId,
      campaign_id: campaignId,
    })
    map.set(campaignId, list)
  }

  return map
}

export function buildAdsetCatalogById(adsets: MetaAdSet[]): Map<string, MetaAdSet> {
  const map = new Map<string, MetaAdSet>()
  for (const adset of adsets) {
    const id = normalizeMetaId(adset.id)
    if (!id) continue
    map.set(id, {
      ...adset,
      id,
      campaign_id: normalizeMetaId(adset.campaign_id),
    })
  }
  return map
}

export function mergeAdSetsForCampaign(
  campaignId: string,
  catalogAdsets: MetaAdSet[],
  adsetInsights: MetaInsightRow[],
  catalogByAdSetId: Map<string, MetaAdSet>
): MetaAdSet[] {
  const normalizedCampaignId = normalizeMetaId(campaignId)
  const byId = new Map<string, MetaAdSet>()

  for (const adset of catalogAdsets) {
    const id = normalizeMetaId(adset.id)
    if (!id) continue
    byId.set(id, adset)
  }

  for (const insight of adsetInsights) {
    if (normalizeMetaId(insight.campaign_id) !== normalizedCampaignId) continue

    const id = normalizeMetaId(insight.adset_id)
    if (!id || byId.has(id)) continue

    const fromCatalog = catalogByAdSetId.get(id)
    byId.set(
      id,
      fromCatalog ?? {
        id,
        name: insight.adset_name,
        campaign_id: normalizedCampaignId,
        status: "UNKNOWN",
      }
    )
  }

  return [...byId.values()]
}

export function countAdSetsForCampaign(adsets: MetaAdSet[]): {
  total: number
  active: number
} {
  return {
    total: adsets.length,
    active: adsets.filter(isMetaAdSetActiveForCount).length,
  }
}
