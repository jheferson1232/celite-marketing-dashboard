import prisma from "@/lib/prisma"
import { convertToCopIfPen } from "@/lib/format/pen-to-cop"
import { listTikTokAdAccounts } from "@/lib/services/tiktok/ad-accounts"
import { fetchAllPages } from "@/lib/services/tiktok/fetch-all-pages"
import {
  fetchIntegratedReport,
  getPurchases,
  getTikTokLifetimeDateRange,
  getMetricNumber,
} from "@/lib/services/tiktok/report"
import { buildTikTokCacheKey } from "@/lib/services/tiktok/tiktok-api.server"
import { withTikTokCache } from "@/lib/services/tiktok/tiktok-cache"
import { withTikTokDashboardAccount } from "@/lib/services/tiktok/tiktok-dashboard-account.server"
import type { TikTokAd } from "@/lib/services/tiktok/types"

const SPEND_TTL_MS = 10 * 60 * 1000
const accountLoads = new Map<string, Promise<VideoAd[]>>()
const AD_FIELDS = JSON.stringify([
  "ad_id",
  "ad_name",
  "ad_text",
  "campaign_id",
  "campaign_name",
  "tiktok_item_id",
  "video_id",
])
const AD_METRICS = ["spend", "complete_payment", "total_purchase", "purchase"] as const

export type BufferPostInvestmentInput = {
  id: string
  text: string
  externalLink?: string | null
  thumbnail?: string | null
}

export type BufferPostInvestment = {
  postId: string
  match: "video" | "producto" | "descripcion"
  productName: string | null
  campaignNames: string[]
  spend: number
  purchases: number
  cpa: number | null
  from: string
  to: string
}

type VideoAd = {
  adId: string
  campaignId: string
  campaignName: string
  adName: string
  adText: string
  itemId: string | null
  spend: number
  purchases: number
}

type ProductCandidate = {
  id: string
  name: string
  campaignIds: string[]
  matchKey: string
}

function normalizeMatchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function extractItemIds(values: Array<string | null | undefined>) {
  const ids = new Set<string>()
  for (const value of values) {
    if (!value) continue
    const fromPath = value.match(/\/(?:video|photo)\/(\d{8,})/)
    if (fromPath?.[1]) ids.add(fromPath[1])
    for (const match of value.matchAll(/\d{15,22}/g)) {
      ids.add(match[0])
    }
  }
  return [...ids]
}

function matchProduct(text: string, products: ProductCandidate[]) {
  const normalized = normalizeMatchText(text)
  if (!normalized) return null
  const haystack = ` ${normalized} `
  const compactHaystack = normalized.replace(/ /g, "")
  return (
    products.find((product) => {
      if (haystack.includes(` ${product.matchKey} `)) return true
      const compactKey = product.matchKey.replace(/ /g, "")
      return compactKey.length >= 6 && compactHaystack.includes(compactKey)
    }) ?? null
  )
}

async function loadAccountVideoAds(account: {
  id: string
  currency: string | null
}): Promise<VideoAd[]> {
  const current = accountLoads.get(account.id)
  if (current) return current

  const load = withTikTokDashboardAccount(account.id, async () => {
    const range = getTikTokLifetimeDateRange()
    const cacheKey = await buildTikTokCacheKey(
      `buffer-video-spend:v2:${range.from}:${range.to}`
    )
    return withTikTokCache(cacheKey, SPEND_TTL_MS, async () => {
      const [ads, rows] = await Promise.all([
        fetchAllPages<TikTokAd>("/ad/get/", {
          fields: AD_FIELDS,
          filtering: JSON.stringify({ primary_status: "STATUS_ALL" }),
        }),
        fetchIntegratedReport(
          "AUCTION_AD",
          ["ad_id"],
          [...AD_METRICS],
          range.from,
          range.to
        ),
      ])

      const metricsByAd = new Map(rows.map((row) => [row.dimensions.ad_id, row.metrics]))

      return ads.flatMap((ad) => {
        const campaignId = ad.campaign_id?.trim() ?? ""
        if (!ad.ad_id || !campaignId) return []
        const metrics = metricsByAd.get(ad.ad_id)
        const spend = convertToCopIfPen(
          getMetricNumber(metrics ?? {}, "spend"),
          account.currency
        )
        const purchases = getPurchases(metrics ?? {})
        return [
          {
            adId: ad.ad_id,
            campaignId,
            campaignName: ad.campaign_name?.trim() || ad.ad_name?.trim() || campaignId,
            adName: ad.ad_name?.trim() || "",
            adText: ad.ad_text?.trim() || "",
            itemId: ad.tiktok_item_id?.trim() || null,
            spend,
            purchases,
          },
        ]
      })
    })
  })

  accountLoads.set(account.id, load)
  try {
    return await load
  } finally {
    accountLoads.delete(account.id)
  }
}

function sumAds(ads: VideoAd[]) {
  const campaignNames: string[] = []
  const seenCampaigns = new Set<string>()
  const seenAds = new Set<string>()
  let spend = 0
  let purchases = 0
  for (const ad of ads) {
    if (seenAds.has(ad.adId)) continue
    seenAds.add(ad.adId)
    spend += ad.spend
    purchases += ad.purchases
    if (seenCampaigns.has(ad.campaignId)) continue
    seenCampaigns.add(ad.campaignId)
    campaignNames.push(ad.campaignName)
  }
  const cpa = purchases > 0 ? spend / purchases : null
  return { spend, purchases, cpa, campaignNames }
}

function nameOverlaps(postText: string, label: string) {
  const post = normalizeMatchText(postText)
  const name = normalizeMatchText(label)
  if (!post || name.length < 6) return false
  if (post.includes(name)) return true
  const words = name.split(" ").filter((word) => word.length >= 3 && !/^\d+$/.test(word))
  for (let start = 0; start < words.length; start += 1) {
    for (let end = start + 2; end <= words.length; end += 1) {
      const slice = words.slice(start, end).join(" ")
      if (slice.length >= 8 && post.includes(slice)) return true
    }
  }
  return false
}

function distinctiveText(value: string) {
  return normalizeMatchText(value)
    .replace(/\batrevete a destacar\b/g, " ")
    .replace(/\b3225153437\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function sameCreativeCopy(postText: string, adText: string) {
  const post = distinctiveText(postText)
  const ad = distinctiveText(adText)
  if (post.length < 24 || ad.length < 24) return false
  const probe = post.slice(0, 48)
  return ad.includes(probe) || post.includes(ad.slice(0, 48))
}

function adsMatchingCopy(text: string, ads: VideoAd[]) {
  return ads.filter(
    (ad) =>
      sameCreativeCopy(text, ad.adText) ||
      sameCreativeCopy(text, ad.adName) ||
      nameOverlaps(text, ad.campaignName)
  )
}

function adsInSameCampaigns(
  seeds: VideoAd[],
  adsByCampaignId: Map<string, VideoAd[]>
) {
  const campaignIds = new Set(seeds.map((ad) => ad.campaignId))
  return [...campaignIds].flatMap((campaignId) => adsByCampaignId.get(campaignId) ?? [])
}

export async function getBufferPostInvestments(
  posts: BufferPostInvestmentInput[]
): Promise<BufferPostInvestment[]> {
  const uniquePosts = posts.filter((post) => post.id.trim()).slice(0, 60)
  if (uniquePosts.length === 0) return []

  const range = getTikTokLifetimeDateRange()
  const [accounts, productRows] = await Promise.all([
    listTikTokAdAccounts(),
    prisma.product.findMany({
      select: {
        id: true,
        name: true,
        variants: { select: { name: true } },
        campaigns: {
          where: { platform: "tiktok" },
          select: { campaignId: true },
        },
      },
    }),
  ])

  const products = productRows
    .flatMap((row) => {
      const keys = [row.name, ...row.variants.map((variant) => variant.name)]
      return keys.flatMap((key) => {
        const matchKey = normalizeMatchText(key)
        if (matchKey.length < 4) return []
        return [
          {
            id: row.id,
            name: row.name,
            campaignIds: [...new Set(row.campaigns.map((campaign) => campaign.campaignId))],
            matchKey,
          },
        ]
      })
    })
    .sort((a, b) => b.matchKey.length - a.matchKey.length)

  const productByCampaign = new Map<string, string>()
  for (const product of products) {
    for (const campaignId of product.campaignIds) {
      if (!productByCampaign.has(campaignId)) {
        productByCampaign.set(campaignId, product.name)
      }
    }
  }

  const adsByAccount = await Promise.all(
    accounts.map(async (account) => {
      try {
        return await loadAccountVideoAds(account)
      } catch (error) {
        console.warn(
          `[buffer] No se pudo leer TikTok Ads de ${account.name}:`,
          error
        )
        return []
      }
    })
  )
  const ads = adsByAccount.flat()
  const adsByItemId = new Map<string, VideoAd[]>()
  const adsByCampaignId = new Map<string, VideoAd[]>()
  for (const ad of ads) {
    const campaignAds = adsByCampaignId.get(ad.campaignId) ?? []
    campaignAds.push(ad)
    adsByCampaignId.set(ad.campaignId, campaignAds)
    if (!ad.itemId) continue
    const itemAds = adsByItemId.get(ad.itemId) ?? []
    itemAds.push(ad)
    adsByItemId.set(ad.itemId, itemAds)
  }

  return uniquePosts.flatMap((post) => {
    const itemIds = extractItemIds([post.externalLink, post.thumbnail])
    const videoSeeds = itemIds.flatMap((itemId) => adsByItemId.get(itemId) ?? [])
    const copySeeds = videoSeeds.length > 0 ? [] : adsMatchingCopy(post.text, ads)
    const seeds = videoSeeds.length > 0 ? videoSeeds : copySeeds
    const product = matchProduct(post.text, products)
    const productAds =
      seeds.length > 0 || !product
        ? []
        : product.campaignIds.flatMap(
            (campaignId) => adsByCampaignId.get(campaignId) ?? []
          )
    const matchedAds =
      seeds.length > 0 ? adsInSameCampaigns(seeds, adsByCampaignId) : productAds
    if (matchedAds.length === 0) return []

    const totals = sumAds(matchedAds)
    const productName =
      product?.name ??
      matchedAds
        .map((ad) => productByCampaign.get(ad.campaignId))
        .find((name) => name) ??
      null
    const match = videoSeeds.length > 0 ? "video" : copySeeds.length > 0 ? "descripcion" : "producto"

    return [
      {
        postId: post.id,
        match,
        productName,
        campaignNames: totals.campaignNames,
        spend: totals.spend,
        purchases: totals.purchases,
        cpa: totals.cpa,
        from: range.from,
        to: range.to,
      },
    ]
  })
}
