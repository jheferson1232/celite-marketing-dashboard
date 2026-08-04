import "server-only"

import type { AxiosInstance } from "axios"
import prisma from "@/lib/prisma"
import { linkProductCampaign } from "@/lib/services/product"
import { listTikTokAdAccounts } from "@/lib/services/tiktok/ad-accounts"
import { getTikTokRequestContext } from "@/lib/services/tiktok/tiktok-api.server"
import { withTikTokDashboardAccount } from "@/lib/services/tiktok/tiktok-dashboard-account.server"

export type AutoLinkTikTokResult = {
  linked: number
  skippedAlreadyLinked: number
  unmatched: number
  accountsProcessed: number
  examples: string[]
}

type ProductRow = { id: string; name: string; tokens: string[] }

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function significantTokens(name: string): string[] {
  const stop = new Set([
    "de",
    "del",
    "la",
    "el",
    "los",
    "las",
    "y",
    "en",
    "00",
    "oferta",
    "test",
    "abo",
    "cbo",
  ])
  return normalize(name)
    .split(" ")
    .filter((t) => t.length >= 3 && !stop.has(t) && !/^\d{1,2}$/.test(t))
}

function hasToken(haystack: string, token: string): boolean {
  return haystack.split(" ").includes(token)
}

function scoreCampaignToProduct(
  campaignName: string,
  product: ProductRow
): number {
  const campaignNorm = normalize(campaignName)
  if (!campaignNorm || product.tokens.length === 0) return 0

  const productNorm = normalize(product.name)
  if (campaignNorm.includes(productNorm) && productNorm.length >= 4) {
    return 1000 + productNorm.length
  }

  let matched = 0
  let matchedChars = 0
  for (const token of product.tokens) {
    if (hasToken(campaignNorm, token)) {
      matched += 1
      matchedChars += token.length
    }
  }
  if (matched === 0) return 0

  const fullBonus = matched === product.tokens.length ? 100 : 0
  return matched * 20 + matchedChars + fullBonus
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isQpsError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.toLowerCase().includes("qps")
}

async function listCampaignsForCurrentAccount(
  client: AxiosInstance,
  advertiserId: string
): Promise<Array<{ id: string; name: string }>> {
  const campaigns: Array<{ id: string; name: string }> = []
  let page = 1
  let totalPage = 1

  while (page <= totalPage) {
    const { data } = await client.get<{
      code?: number
      message?: string
      data?: {
        list?: Array<{
          campaign_id?: string
          campaign_name?: string
        }>
        page_info?: { total_page?: number }
      }
    }>("/campaign/get/", {
      params: {
        advertiser_id: advertiserId,
        page,
        page_size: 100,
        fields: JSON.stringify([
          "campaign_id",
          "campaign_name",
          "operation_status",
        ]),
      },
    })

    if (data.code !== 0) {
      throw new Error(data.message || "Error al listar campañas TikTok")
    }

    for (const row of data.data?.list ?? []) {
      const id = String(row.campaign_id ?? "").trim()
      const name = String(row.campaign_name ?? "").trim()
      if (!id) continue
      campaigns.push({ id, name: name || id })
    }

    totalPage = Number(data.data?.page_info?.total_page || 1)
    page += 1
    if (page > 30) break
  }

  return campaigns
}

async function listCampaignsWithRetry(
  accountId: string
): Promise<Array<{ id: string; name: string }>> {
  let lastError: unknown
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await withTikTokDashboardAccount(accountId, async () => {
        const { client, advertiserId } = await getTikTokRequestContext()
        return listCampaignsForCurrentAccount(client, advertiserId)
      })
    } catch (error) {
      lastError = error
      if (attempt < 3 && isQpsError(error)) {
        await sleep(500 * (attempt + 1))
        continue
      }
      throw error
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("No se pudieron listar campañas TikTok")
}

/** Vincula campañas TikTok de todas las cuentas activas a productos por nombre. */
export async function autoLinkTikTokCampaignsToProducts(): Promise<AutoLinkTikTokResult> {
  const productsRaw = await prisma.product.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })

  const products: ProductRow[] = productsRaw
    .map((p) => ({
      id: p.id,
      name: p.name,
      tokens: significantTokens(p.name),
    }))
    .filter((p) => p.tokens.length > 0)
    .toSorted(
      (a, b) => b.tokens.join("").length - a.tokens.join("").length
    )

  const existing = await prisma.productCampaign.findMany({
    where: { platform: "tiktok" },
    select: { campaignId: true },
  })
  const linkedCampaignIds = new Set(existing.map((e) => e.campaignId))

  const accounts = await listTikTokAdAccounts()
  let linked = 0
  let skippedAlreadyLinked = 0
  let unmatched = 0
  let accountsProcessed = 0
  const examples: string[] = []

  for (const account of accounts) {
    let campaigns: Array<{ id: string; name: string }> = []
    try {
      campaigns = await listCampaignsWithRetry(account.id)
      accountsProcessed += 1
    } catch (error) {
      console.warn(
        `[auto-link-tiktok] No se listaron campañas de ${account.name}:`,
        error
      )
      continue
    }

    for (const campaign of campaigns) {
      if (linkedCampaignIds.has(campaign.id)) {
        skippedAlreadyLinked += 1
        continue
      }

      let best: ProductRow | null = null
      let bestScore = 0
      let secondScore = 0
      for (const product of products) {
        const score = scoreCampaignToProduct(campaign.name, product)
        if (score > bestScore) {
          secondScore = bestScore
          bestScore = score
          best = product
        } else if (score > secondScore) {
          secondScore = score
        }
      }

      if (!best || bestScore < 20 || bestScore === secondScore) {
        unmatched += 1
        continue
      }

      await linkProductCampaign({
        productId: best.id,
        campaignId: campaign.id,
        campaignName: campaign.name,
        platform: "tiktok",
      })

      linkedCampaignIds.add(campaign.id)
      linked += 1
      if (examples.length < 30) {
        examples.push(`${campaign.name} → ${best.name}`)
      }
    }

    await sleep(200)
  }

  return {
    linked,
    skippedAlreadyLinked,
    unmatched,
    accountsProcessed,
    examples,
  }
}
