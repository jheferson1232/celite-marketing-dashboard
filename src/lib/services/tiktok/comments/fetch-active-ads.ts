import "server-only"

import { listTikTokAdAccounts } from "../ad-accounts"
import { mapWithConcurrency } from "../concurrency"
import { fetchAllPages } from "../fetch-all-pages"
import { listTikTokSparkPosts } from "../spark-posts"
import { getTikTokRequestContext } from "../tiktok-api.server"
import { withTikTokDashboardAccount } from "../tiktok-dashboard-account.server"
import {
  matchesTikTokCommentSparkProfile,
  TIKTOK_COMMENT_ACCOUNT_CONCURRENCY,
} from "./constants"
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
  "display_name",
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
  display_name?: string
}

function isActiveAd(row: TikTokAdRow): boolean {
  return (row.operation_status ?? "").toUpperCase() === "ENABLE"
}

function stampAccount(
  ad: Omit<TikTokActiveAdRef, "accountId" | "accountName">,
  account: { id: string | null; name: string | null }
): TikTokActiveAdRef {
  return {
    ...ad,
    accountId: account.id,
    accountName: account.name,
  }
}

/** Anuncios activos ENABLE (incl. Spark). */
export async function fetchActiveTikTokAdsWithCreative(): Promise<
  TikTokActiveAdRef[]
> {
  const [{ credentials }, rows, sparkPosts] = await Promise.all([
    getTikTokRequestContext(),
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

  const account = {
    id: credentials.accountId,
    name: null as string | null,
  }

  const byAdId = new Map<string, TikTokActiveAdRef>()

  for (const row of rows) {
    if (!row.ad_id || !isActiveAd(row)) continue
    if (byAdId.has(row.ad_id)) continue

    const itemId = row.tiktok_item_id?.trim() || null
    const spark = itemId ? sparkByItemId.get(itemId) : undefined
    const profileName =
      spark?.profileName?.trim() || row.display_name?.trim() || null
    const isSparkTarget = matchesTikTokCommentSparkProfile(profileName)

    byAdId.set(
      row.ad_id,
      stampAccount(
        {
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
        },
        account
      )
    )
  }

  return [...byAdId.values()]
}

function unitsFromAds(ads: TikTokActiveAdRef[]): {
  units: TikTokCommentSearchUnit[]
  adsScanned: number
  sparkTargetAds: number
} {
  const sparkAds = ads.filter((ad) => ad.isSparkTarget && ad.adgroupId)
  const sourceAds =
    sparkAds.length > 0 ? sparkAds : ads.filter((ad) => ad.adgroupId)

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
  return unitsFromAds(ads)
}

function withAccountName(
  result: {
    units: TikTokCommentSearchUnit[]
    adsScanned: number
    sparkTargetAds: number
  },
  account: { id: string; name: string }
) {
  return {
    adsScanned: result.adsScanned,
    sparkTargetAds: result.sparkTargetAds,
    units: result.units.map((unit) => ({
      ...unit,
      ad: {
        ...unit.ad,
        accountId: account.id,
        accountName: account.name,
      },
    })),
  }
}

/** Misma búsqueda, en todas las cuentas TikTok activas. */
export async function listTikTokCommentSearchUnitsAllAccounts(): Promise<{
  units: TikTokCommentSearchUnit[]
  adsScanned: number
  sparkTargetAds: number
}> {
  const accounts = await listTikTokAdAccounts().catch(() => [])

  if (accounts.length === 0) {
    return listTikTokCommentSearchUnits()
  }

  const results = await mapWithConcurrency(
    accounts,
    TIKTOK_COMMENT_ACCOUNT_CONCURRENCY,
    async (account) => {
      try {
        const result = await withTikTokDashboardAccount(account.id, () =>
          listTikTokCommentSearchUnits()
        )
        return withAccountName(result, account)
      } catch (error) {
        console.warn(
          `[tiktok-comments] No se pudieron listar ads de ${account.name}:`,
          error
        )
        return { units: [], adsScanned: 0, sparkTargetAds: 0 }
      }
    }
  )

  return {
    units: results.flatMap((result) => result.units),
    adsScanned: results.reduce((sum, result) => sum + result.adsScanned, 0),
    sparkTargetAds: results.reduce(
      (sum, result) => sum + result.sparkTargetAds,
      0
    ),
  }
}
