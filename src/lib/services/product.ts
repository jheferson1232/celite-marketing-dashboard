import prisma from "@/lib/prisma"
import { getProductCoverImage } from "@/lib/products/cover-image"
import { deleteProductMedia } from "@/lib/services/blob/product-media"
import { fetchLandingPagePreviewImage } from "@/lib/services/landing-page-preview"
import { getMetaCampaignDailyInsights } from "@/lib/services/meta/campaign-daily-insights"
import type { DateRange } from "@/lib/services/meta/types"
import {
  getTikTokCampaignDailyInsights,
  type TikTokCampaignDailyInsightsSummary,
} from "@/lib/services/tiktok/campaign-daily-insights"
import {
  evaluateProductReadiness,
  type ProductReadinessResult,
} from "@/lib/products/readiness"
import {
  isProductStatus,
  PRODUCT_STATUS_VALUES,
  type ProductStatus,
} from "@/lib/products/status"

export type { ProductStatus } from "@/lib/products/status"
export { PRODUCT_STATUS_VALUES } from "@/lib/products/status"

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
  landingPages: { orderBy: { url: "asc" as const } },
} as const

export type ProductLandingPageRecord = {
  id: string
  url: string
  createdAt: Date
  updatedAt: Date
}

export type ProductRecord = {
  id: string
  name: string
  status: ProductStatus
  imageUrl: string | null
  images: string[]
  videos: string[]
  landingPages: ProductLandingPageRecord[]
  budget: number
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
  status?: ProductStatus
  imageUrl?: string | null
  images?: string[]
  videos?: string[]
  landingPageIds?: string[]
  budget?: number
  notes?: string | null
}

export type UpdateProductInput = {
  id: string
  name?: string
  status?: ProductStatus
  imageUrl?: string | null
  images?: string[]
  videos?: string[]
  landingPageIds?: string[]
  budget?: number
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

function sanitizeIdList(ids: string[] | undefined): string[] {
  if (!ids?.length) return []
  const seen = new Set<string>()
  const result: string[] = []

  for (const raw of ids) {
    const id = raw.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    result.push(id)
  }

  return result
}

function sanitizeUrlList(urls: string[] | undefined): string[] {
  if (!urls?.length) return []
  const seen = new Set<string>()
  const result: string[] = []

  for (const raw of urls) {
    const url = raw.trim()
    if (!url || seen.has(url)) continue
    seen.add(url)
    result.push(url)
  }

  return result
}

function resolvePrimaryImageUrl(
  imageUrl: string | null | undefined,
  images: string[]
): string | null {
  return images[0] ?? (imageUrl?.trim() || null)
}

function normalizeBudget(value: number | undefined): number | undefined {
  if (value === undefined) return undefined
  if (!Number.isFinite(value)) return 0
  return Math.max(0, value)
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
  const images = sanitizeUrlList(input.images)
  const videos = sanitizeUrlList(input.videos)
  const landingPageIds = sanitizeIdList(input.landingPageIds)

  return prisma.product.create({
    data: {
      name: input.name.trim(),
      status: input.status ?? "draft",
      imageUrl: resolvePrimaryImageUrl(input.imageUrl, images),
      images,
      videos,
      budget: normalizeBudget(input.budget) ?? 0,
      notes: input.notes?.trim() || null,
      ...(landingPageIds.length > 0
        ? {
            landingPages: {
              connect: landingPageIds.map((id) => ({ id })),
            },
          }
        : {}),
    },
    include: productInclude,
  })
}

export async function updateProduct(
  input: UpdateProductInput
): Promise<ProductRecord> {
  const existing = await prisma.product.findUnique({
    where: { id: input.id },
    select: { images: true, videos: true },
  })
  if (!existing) throw new Error("Producto no encontrado")

  const data: {
    name?: string
    status?: ProductStatus
    imageUrl?: string | null
    images?: string[]
    videos?: string[]
    budget?: number
    notes?: string | null
    landingPages?: { set: Array<{ id: string }> }
  } = {}

  if (input.name !== undefined) data.name = input.name.trim()
  if (input.status !== undefined) {
    if (!isProductStatus(input.status)) {
      throw new Error("Estado de producto inválido")
    }
    data.status = input.status
  }
  if (input.notes !== undefined) data.notes = input.notes?.trim() || null
  if (input.budget !== undefined) data.budget = normalizeBudget(input.budget) ?? 0

  const nextImages =
    input.images !== undefined ? sanitizeUrlList(input.images) : undefined
  const nextVideos =
    input.videos !== undefined ? sanitizeUrlList(input.videos) : undefined
  const nextLandingPageIds =
    input.landingPageIds !== undefined
      ? sanitizeIdList(input.landingPageIds)
      : undefined

  if (nextImages !== undefined) data.images = nextImages
  if (nextVideos !== undefined) data.videos = nextVideos
  if (nextLandingPageIds !== undefined) {
    data.landingPages = {
      set: nextLandingPageIds.map((id) => ({ id })),
    }
  }

  if (input.imageUrl !== undefined || nextImages !== undefined) {
    const images = nextImages ?? existing.images
    data.imageUrl = resolvePrimaryImageUrl(input.imageUrl, images)
  }

  const removedMedia = [
    ...(input.images !== undefined
      ? existing.images.filter((url) => !nextImages!.includes(url))
      : []),
    ...(input.videos !== undefined
      ? existing.videos.filter((url) => !nextVideos!.includes(url))
      : []),
  ]

  const updated = await prisma.product.update({
    where: { id: input.id },
    data,
    include: productInclude,
  })

  if (removedMedia.length > 0) {
    await deleteProductMedia(removedMedia)
  }

  return updated
}

/** Si no hay imagen, intenta guardar og:image de la primera landing como portada. */
async function persistProductCoverFromLandings(
  product: ProductRecord
): Promise<ProductRecord> {
  if (getProductCoverImage(product) || product.landingPages.length === 0) {
    return product
  }

  for (const landingPage of product.landingPages) {
    const preview = await fetchLandingPagePreviewImage(landingPage.url)
    if (!preview) continue

    return updateProduct({
      id: product.id,
      imageUrl: preview,
      images: [preview],
    })
  }

  return product
}

export type SaveProductEditResult = {
  product: ProductRecord
  readiness: ProductReadinessResult
  promotedToReady: boolean
}

/** Guardado desde edición: persiste datos y pasa Draft → Ready si cumple preflight. */
export async function saveProductEdit(
  input: UpdateProductInput
): Promise<SaveProductEditResult> {
  const before = await prisma.product.findUnique({
    where: { id: input.id },
    select: { status: true },
  })
  if (!before) throw new Error("Producto no encontrado")

  let updated = await updateProduct(input)
  updated = await persistProductCoverFromLandings(updated)
  const readiness = evaluateProductReadiness(updated)

  let product = updated
  let promotedToReady = false

  if (before.status === "draft" && readiness.ready) {
    product = await updateProductStatus(updated.id, "ready")
    promotedToReady = true
  }

  return { product, readiness, promotedToReady }
}

export async function updateProductStatus(
  productId: string,
  status: ProductStatus
): Promise<ProductRecord> {
  if (!isProductStatus(status)) {
    throw new Error("Estado de producto inválido")
  }

  const existing = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  })
  if (!existing) throw new Error("Producto no encontrado")

  return prisma.product.update({
    where: { id: productId },
    data: { status },
    include: productInclude,
  })
}

export async function deleteProduct(id: string): Promise<void> {
  const existing = await prisma.product.findUnique({
    where: { id },
    select: { images: true, videos: true, imageUrl: true },
  })
  if (!existing) return

  await prisma.product.delete({ where: { id } })

  const mediaUrls = [
    ...existing.images,
    ...existing.videos,
    ...(existing.imageUrl ? [existing.imageUrl] : []),
  ]
  await deleteProductMedia(mediaUrls)
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
