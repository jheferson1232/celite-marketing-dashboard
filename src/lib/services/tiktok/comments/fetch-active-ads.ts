import "server-only"

import { listTikTokSparkPosts } from "../spark-posts"
import { fetchAllPages } from "../fetch-all-pages"
import { matchesTikTokCommentSparkProfile } from "./constants"
import type { TikTokActiveAdRef, TikTokCommentSearchUnit } from "./types"

const AD_GET_FIELDS = JSON.stringify([
  "ad_id",
  "ad_name",
  "adgroup_id",
  "operation_status",
  "video_id",
  "tiktok_item_id",
  "identity_id",
  "identity_type",
])

type TikTokAdRow = {
  ad_id: string
  ad_name?: string
  adgroup_id?: string
  operation_status?: string
  video_id?: string
  tiktok_item_id?: string
  identity_id?: string
  identity_type?: string
}

function isActiveAd(row: TikTokAdRow): boolean {
  return (row.operation_status ?? "").toUpperCase() === "ENABLE"
}

/** Anuncios activos ENABLE (incl. Spark). */
export async function fetchActiveTikTokAdsWithCreative(): Promise<
  TikTokActiveAdRef[]
> {
  const [rows, sparkPosts] = await Promise.all([
    fetchAllPages<TikTokAdRow>("/ad/get/", {
      fields: AD_GET_FIELDS,
      filtering: JSON.stringify({
        operation_status: "ENABLE",
      }),
    }),
    listTikTokSparkPosts().catch(() => []),
  ])

  const sparkByItemId = new Map(
    sparkPosts
      .filter((post) => post.itemId)
      .map((post) => [post.itemId!, post])
  )

  const byAdId = new Map<string, TikTokActiveAdRef>()

  for (const row of rows) {
    if (!row.ad_id || !isActiveAd(row)) continue
    if (byAdId.has(row.ad_id)) continue

    const itemId = row.tiktok_item_id?.trim() || null
    const spark = itemId ? sparkByItemId.get(itemId) : undefined
    const profileName = spark?.profileName ?? null
    const isSparkTarget = matchesTikTokCommentSparkProfile(profileName)

    byAdId.set(row.ad_id, {
      adId: row.ad_id,
      adName: row.ad_name?.trim() || row.ad_id,
      adgroupId: row.adgroup_id?.trim() || null,
      tiktokItemId: itemId,
      identityId:
        row.identity_id?.trim() || spark?.identityId?.trim() || null,
      identityType:
        row.identity_type?.trim() || spark?.identityType?.trim() || null,
      videoId: row.video_id?.trim() || null,
      profileName,
      isSparkTarget,
    })
  }

  return [...byAdId.values()]
}

/**
 * Unidades de búsqueda de comentarios: un adgroup = una llamada API.
 * Prioriza Spark de Calzados_urbanos / Calzados Elite; si no hay, usa todos.
 */
export async function listTikTokCommentSearchUnits(): Promise<{
  units: TikTokCommentSearchUnit[]
  adsScanned: number
  sparkTargetAds: number
}> {
  const ads = await fetchActiveTikTokAdsWithCreative()
  const sparkAds = ads.filter((ad) => ad.isSparkTarget && ad.adgroupId)
  const sourceAds = sparkAds.length > 0 ? sparkAds : ads.filter((ad) => ad.adgroupId)

  const byAdgroup = new Map<string, TikTokCommentSearchUnit>()
  for (const ad of sourceAds) {
    if (!ad.adgroupId || byAdgroup.has(ad.adgroupId)) continue
    byAdgroup.set(ad.adgroupId, { adgroupId: ad.adgroupId, ad })
  }

  return {
    units: [...byAdgroup.values()],
    adsScanned: sourceAds.length,
    sparkTargetAds: sparkAds.length,
  }
}
