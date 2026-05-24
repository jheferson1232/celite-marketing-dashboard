import prisma from "@/lib/prisma"
import { getMetaCampaignDailyInsights } from "@/lib/services/meta/campaign-daily-insights"
import type { DateRange } from "@/lib/services/meta/types"
import {
  getTikTokCampaignDailyInsights,
  type TikTokCampaignDailyInsight,
  type TikTokCampaignDailyInsightsSummary,
} from "@/lib/services/tiktok/campaign-daily-insights"

export type ProductPlatform = "tiktok" | "meta"

export type ProductDailyInsight = {
  date: string
  spend: number
  purchases: number
  cpa: number
  cpc?: number
  impressions?: number
}

export type ProductSalesTotals = {
  spend: number
  purchases: number
  cpa: number
}

export type ProductPlatformSalesHistory = {
  campaignIds: string[]
  days: ProductDailyInsight[]
  totals: ProductSalesTotals
}

const productInclude = {
  variants: { orderBy: { color: "asc" as const } },
  campaigns: { orderBy: { createdAt: "desc" as const } },
} as const

export type ProductRecord = {
  id: string
  name: string
  imageUrl: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
  variants: Array<{
    id: string
    productId: string
    color: string
    imageUrl: string | null
    url: string
    updatedAt: Date
  }>
  campaigns: Array<{
    id: string
    productId: string
    campaignId: string
    campaignName: string | null
    platform: string
    createdAt: Date
  }>
}

export type CreateProductInput = {
  name: string
  imageUrl?: string | null
  notes?: string | null
}

export type UpdateProductInput = {
  id: string
  name?: string
  imageUrl?: string | null
  notes?: string | null
}

export type CreateProductVariantInput = {
  productId: string
  color: string
  imageUrl?: string | null
  url: string
}

export type UpdateProductVariantInput = {
  id: string
  color?: string
  imageUrl?: string | null
  url?: string
}

export type LinkProductCampaignInput = {
  productId: string
  campaignId: string
  campaignName?: string | null
  platform: ProductPlatform
}

export type ProductSalesHistorySummary = {
  productId: string
  dateRange: DateRange
  tiktok: ProductPlatformSalesHistory | null
  meta: ProductPlatformSalesHistory | null
}

export async function listProducts(): Promise<ProductRecord[]> {
  return prisma.product.findMany({
    include: productInclude,
    orderBy: { updatedAt: "desc" },
  })
}

export async function getProductById(id: string): Promise<ProductRecord | null> {
  return prisma.product.findUnique({
    where: { id },
    include: productInclude,
  })
}

export async function createProduct(
  input: CreateProductInput
): Promise<ProductRecord> {
  return prisma.product.create({
    data: {
      name: input.name.trim(),
      imageUrl: input.imageUrl?.trim() || null,
      notes: input.notes?.trim() || null,
    },
    include: productInclude,
  })
}

export async function updateProduct(
  input: UpdateProductInput
): Promise<ProductRecord> {
  const data: {
    name?: string
    imageUrl?: string | null
    notes?: string | null
  } = {}

  if (input.name !== undefined) data.name = input.name.trim()
  if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl?.trim() || null
  if (input.notes !== undefined) data.notes = input.notes?.trim() || null

  return prisma.product.update({
    where: { id: input.id },
    data,
    include: productInclude,
  })
}

export async function deleteProduct(id: string): Promise<void> {
  await prisma.product.delete({ where: { id } })
}

export async function createProductVariant(
  input: CreateProductVariantInput
): Promise<ProductRecord> {
  await prisma.productVariant.create({
    data: {
      productId: input.productId,
      color: input.color.trim(),
      imageUrl: input.imageUrl?.trim() || null,
      url: input.url.trim(),
    },
  })

  const product = await getProductById(input.productId)
  if (!product) throw new Error("Producto no encontrado")
  return product
}

export async function updateProductVariant(
  input: UpdateProductVariantInput
): Promise<ProductRecord> {
  const existing = await prisma.productVariant.findUnique({
    where: { id: input.id },
    select: { productId: true },
  })
  if (!existing) throw new Error("Variante no encontrada")

  const data: {
    color?: string
    imageUrl?: string | null
    url?: string
  } = {}
  if (input.color !== undefined) data.color = input.color.trim()
  if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl?.trim() || null
  if (input.url !== undefined) data.url = input.url.trim()

  await prisma.productVariant.update({
    where: { id: input.id },
    data,
  })

  const product = await getProductById(existing.productId)
  if (!product) throw new Error("Producto no encontrado")
  return product
}

export async function deleteProductVariant(
  variantId: string
): Promise<ProductRecord> {
  const existing = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { productId: true },
  })
  if (!existing) throw new Error("Variante no encontrada")

  await prisma.productVariant.delete({ where: { id: variantId } })

  const product = await getProductById(existing.productId)
  if (!product) throw new Error("Producto no encontrado")
  return product
}

export async function linkProductCampaign(
  input: LinkProductCampaignInput
): Promise<ProductRecord> {
  await prisma.productCampaign.upsert({
    where: {
      productId_campaignId_platform: {
        productId: input.productId,
        campaignId: input.campaignId,
        platform: input.platform,
      },
    },
    create: {
      productId: input.productId,
      campaignId: input.campaignId,
      campaignName: input.campaignName?.trim() || null,
      platform: input.platform,
    },
    update: {
      campaignName: input.campaignName?.trim() || null,
    },
  })

  const product = await getProductById(input.productId)
  if (!product) throw new Error("Producto no encontrado")
  return product
}

export async function unlinkProductCampaign(
  productId: string,
  campaignId: string,
  platform: ProductPlatform
): Promise<ProductRecord> {
  await prisma.productCampaign.delete({
    where: {
      productId_campaignId_platform: { productId, campaignId, platform },
    },
  })

  const product = await getProductById(productId)
  if (!product) throw new Error("Producto no encontrado")
  return product
}

export function mergeTikTokDailyInsights(
  summaries: TikTokCampaignDailyInsightsSummary[]
): ProductDailyInsight[] {
  const byDate = new Map<string, ProductDailyInsight>()

  for (const summary of summaries) {
    for (const day of summary.days) {
      const prev = byDate.get(day.date)
      if (!prev) {
        byDate.set(day.date, { ...day })
        continue
      }
      const spend = prev.spend + day.spend
      const purchases = prev.purchases + day.purchases
      byDate.set(day.date, {
        date: day.date,
        spend,
        purchases,
        cpa: purchases > 0 ? spend / purchases : 0,
        cpc: (prev.cpc ?? 0) + (day.cpc ?? 0),
        impressions: (prev.impressions ?? 0) + (day.impressions ?? 0),
      })
    }
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function mergeMetaDailyInsights(
  summaries: Array<{ days: ProductDailyInsight[] }>
): ProductDailyInsight[] {
  const byDate = new Map<string, ProductDailyInsight>()

  for (const summary of summaries) {
    for (const day of summary.days) {
      const prev = byDate.get(day.date)
      if (!prev) {
        byDate.set(day.date, { ...day })
        continue
      }
      const spend = prev.spend + day.spend
      const purchases = prev.purchases + day.purchases
      byDate.set(day.date, {
        date: day.date,
        spend,
        purchases,
        cpa: purchases > 0 ? spend / purchases : 0,
      })
    }
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function buildTotals(days: ProductDailyInsight[]): ProductSalesTotals {
  const spend = days.reduce((sum, d) => sum + d.spend, 0)
  const purchases = days.reduce((sum, d) => sum + d.purchases, 0)
  return {
    spend,
    purchases,
    cpa: purchases > 0 ? spend / purchases : 0,
  }
}

async function fetchPlatformSalesHistory(
  campaignIds: string[],
  dateRange: DateRange,
  platform: ProductPlatform
): Promise<ProductPlatformSalesHistory | null> {
  if (campaignIds.length === 0) return null

  if (platform === "tiktok") {
    const summaries = await Promise.all(
      campaignIds.map((campaignId) =>
        getTikTokCampaignDailyInsights(campaignId, dateRange)
      )
    )
    const days = mergeTikTokDailyInsights(summaries)
    return { campaignIds, days, totals: buildTotals(days) }
  }

  const summaries = await Promise.all(
    campaignIds.map((campaignId) =>
      getMetaCampaignDailyInsights(campaignId, dateRange, "OUTCOME_SALES")
    )
  )
  const days = mergeMetaDailyInsights(
    summaries.map((s) => ({
      days: s.days.map((d) => ({
        date: d.date,
        spend: d.spend,
        purchases: d.purchases,
        cpa: d.cpa,
      })),
    }))
  )
  return { campaignIds, days, totals: buildTotals(days) }
}

export async function getProductSalesHistory(
  productId: string,
  dateRange: DateRange
): Promise<ProductSalesHistorySummary> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { campaigns: true },
  })

  if (!product) throw new Error("Producto no encontrado")

  const tiktokIds = product.campaigns
    .filter((c) => c.platform === "tiktok")
    .map((c) => c.campaignId)
  const metaIds = product.campaigns
    .filter((c) => c.platform === "meta")
    .map((c) => c.campaignId)

  const [tiktok, meta] = await Promise.all([
    fetchPlatformSalesHistory(tiktokIds, dateRange, "tiktok"),
    fetchPlatformSalesHistory(metaIds, dateRange, "meta"),
  ])

  return {
    productId,
    dateRange,
    tiktok,
    meta,
  }
}
