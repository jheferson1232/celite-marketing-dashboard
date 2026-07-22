import prisma from "@/lib/prisma"
import {
  getCoverLandingUrls,
  getProductCoverImage,
  pickPrimaryVariant,
} from "@/lib/products/cover-image"
import {
  attachCreativeToVariants,
  createCreativeFromUrl,
  detachCreativeFromVariant,
} from "@/lib/services/creative"
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

const variantCreativeSelect = {
  id: true,
  url: true,
  type: true,
  name: true,
  createdAt: true,
  updatedAt: true,
} as const

const productInclude = {
  variants: {
    orderBy: { name: "asc" as const },
    include: {
      creatives: {
        orderBy: { createdAt: "asc" as const },
        select: variantCreativeSelect,
      },
    },
  },
  campaigns: { orderBy: { createdAt: "desc" as const } },
  landingPages: { orderBy: { url: "asc" as const } },
}

export type ProductLandingPageRecord = {
  id: string
  url: string
  createdAt: Date
  updatedAt: Date
}

export type ProductVariantCreativeRecord = {
  id: string
  url: string
  type: "image" | "video"
  name: string | null
  createdAt: Date
  updatedAt: Date
}

export type ProductVariantRecord = {
  id: string
  productId: string
  name: string
  updatedAt: Date
  creatives: ProductVariantCreativeRecord[]
}

export type ProductRecord = {
  id: string
  name: string
  status: ProductStatus
  landingPages: ProductLandingPageRecord[]
  budget: number
  notes: string | null
  createdAt: Date
  updatedAt: Date
  variants: ProductVariantRecord[]
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
  landingPageIds?: string[]
  budget?: number
  notes?: string | null
  /** URL externa de portada (legacy producto): crea/asocia creative de imagen. */
  coverImageUrl?: string | null
}

export type UpdateProductInput = {
  id: string
  name?: string
  status?: ProductStatus
  landingPageIds?: string[]
  budget?: number
  notes?: string | null
  /** URL externa de portada (legacy producto): crea/asocia creative de imagen. */
  coverImageUrl?: string | null
}

export type CreateProductVariantInput = {
  productId: string
  name: string
}

export type UpdateProductVariantInput = {
  id: string
  name?: string
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

function normalizeBudget(value: number | undefined): number | undefined {
  if (value === undefined) return undefined
  if (!Number.isFinite(value)) return 0
  return Math.max(0, value)
}

async function primaryVariantId(productId: string): Promise<string | null> {
  const variant = await prisma.productVariant.findFirst({
    where: { productId },
    orderBy: { name: "asc" },
    select: { id: true },
  })
  return variant?.id ?? null
}

async function applyLegacyCoverImageUrl(
  productId: string,
  coverImageUrl: string | null | undefined
): Promise<void> {
  const url = coverImageUrl?.trim()
  if (!url) return

  const variantId = await primaryVariantId(productId)
  if (!variantId) return

  await createCreativeFromUrl({
    url,
    type: "image",
    variantIds: [variantId],
  })
}

export async function listProducts(): Promise<ProductRecord[]> {
  return prisma.product.findMany({
    include: productInclude,
    orderBy: { updatedAt: "desc" },
  })
}

/** Índice campaña (Meta/TikTok) → productos (etiquetas en dashboard). */
export type CampaignProductLink = {
  campaignId: string
  productId: string
  productName: string
}

/** @deprecated Usar CampaignProductLink */
export type MetaCampaignProductLink = CampaignProductLink

export async function listCampaignProductLinks(
  platform: ProductPlatform
): Promise<CampaignProductLink[]> {
  const rows = await prisma.productCampaign.findMany({
    where: { platform },
    select: {
      campaignId: true,
      productId: true,
      product: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  })
  return rows.map((row) => ({
    campaignId: row.campaignId,
    productId: row.productId,
    productName: row.product.name,
  }))
}

export async function listMetaCampaignProductLinks(): Promise<
  CampaignProductLink[]
> {
  return listCampaignProductLinks("meta")
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
  const landingPageIds = sanitizeIdList(input.landingPageIds)

  return prisma.product.create({
    data: {
      name: input.name.trim(),
      status: input.status ?? "draft",
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
  }).then(async (created) => {
    if (input.coverImageUrl) {
      await applyLegacyCoverImageUrl(created.id, input.coverImageUrl)
      const next = await getProductById(created.id)
      return next ?? created
    }
    return created
  })
}

export async function updateProduct(
  input: UpdateProductInput
): Promise<ProductRecord> {
  const existing = await prisma.product.findUnique({
    where: { id: input.id },
    select: { id: true },
  })
  if (!existing) throw new Error("Producto no encontrado")

  const data: {
    name?: string
    status?: ProductStatus
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

  const nextLandingPageIds =
    input.landingPageIds !== undefined
      ? sanitizeIdList(input.landingPageIds)
      : undefined

  if (nextLandingPageIds !== undefined) {
    data.landingPages = {
      set: nextLandingPageIds.map((id) => ({ id })),
    }
  }

  await prisma.product.update({
    where: { id: input.id },
    data,
  })

  if (input.coverImageUrl !== undefined) {
    await applyLegacyCoverImageUrl(input.id, input.coverImageUrl)
  }

  const updated = await prisma.product.findUnique({
    where: { id: input.id },
    include: productInclude,
  })
  if (!updated) throw new Error("Producto no encontrado")

  return updated
}

/** Si no hay imagen, guarda og:image de la landing de la variante (sin cambiar el nombre). */
async function persistProductCoverFromLandings(
  product: ProductRecord
): Promise<ProductRecord> {
  if (getProductCoverImage(product)) return product

  const landingUrls = getCoverLandingUrls(product)
  if (landingUrls.length === 0) return product

  for (const url of landingUrls) {
    const preview = await fetchLandingPagePreviewImage(url)
    if (!preview) continue

    const variantId =
      pickPrimaryVariant(product)?.id ?? product.variants[0]?.id ?? null
    if (!variantId) return product

    return createCreativeFromUrl({
      url: preview,
      type: "image",
      variantIds: [variantId],
    }).then(() => getProductById(product.id)).then((next) => next ?? product)
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
    select: { id: true },
  })
  if (!existing) return

  await prisma.product.delete({ where: { id } })
}

export async function createProductVariant(
  input: CreateProductVariantInput
): Promise<ProductRecord> {
  const name = input.name.trim()
  if (!name) throw new Error("El nombre de la variante es obligatorio")

  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: { id: true },
  })
  if (!product) throw new Error("Producto no encontrado")

  await prisma.productVariant.create({
    data: {
      productId: input.productId,
      name,
    },
  })

  const updated = await getProductById(input.productId)
  if (!updated) throw new Error("Producto no encontrado")
  return updated
}

export async function updateProductVariant(
  input: UpdateProductVariantInput
): Promise<ProductRecord> {
  const existing = await prisma.productVariant.findUnique({
    where: { id: input.id },
    select: { productId: true },
  })
  if (!existing) throw new Error("Variante no encontrada")

  const data: { name?: string } = {}
  if (input.name !== undefined) data.name = input.name.trim()

  await prisma.productVariant.update({
    where: { id: input.id },
    data,
  })

  const product = await getProductById(existing.productId)
  if (!product) throw new Error("Producto no encontrado")
  return product
}

export async function attachCreativeToProductVariant(
  variantId: string,
  creativeId: string
): Promise<ProductRecord> {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { productId: true },
  })
  if (!variant) throw new Error("Variante no encontrada")

  await attachCreativeToVariants(creativeId, [variantId])

  const product = await getProductById(variant.productId)
  if (!product) throw new Error("Producto no encontrado")
  return product
}

export async function detachCreativeFromProductVariant(
  variantId: string,
  creativeId: string
): Promise<ProductRecord> {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { productId: true },
  })
  if (!variant) throw new Error("Variante no encontrada")

  await detachCreativeFromVariant(creativeId, variantId)

  const product = await getProductById(variant.productId)
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
