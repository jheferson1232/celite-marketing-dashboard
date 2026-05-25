import prisma from "@/lib/prisma"

export type LandingPageRecord = {
  id: string
  url: string
  createdAt: Date
  updatedAt: Date
}

export type LandingPageCampaignUsage = {
  id: string
  name: string
}

function normalizeLandingPageUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed
  }
  return `https://${trimmed}`
}

function parseLandingPageIdFromConfig(config: unknown): string | null {
  if (!config || typeof config !== "object") return null
  const dynamic = (config as Record<string, unknown>).dynamic
  if (!dynamic || typeof dynamic !== "object") return null
  const landingPageId = (dynamic as Record<string, unknown>).landingPageId
  return typeof landingPageId === "string" ? landingPageId : null
}

function parseLandingPageUrlFromConfig(config: unknown): string | null {
  if (!config || typeof config !== "object") return null
  const dynamic = (config as Record<string, unknown>).dynamic
  if (!dynamic || typeof dynamic !== "object") return null
  const landingPageUrl = (dynamic as Record<string, unknown>).landingPageUrl
  return typeof landingPageUrl === "string" ? landingPageUrl : null
}

export async function listLandingPages(): Promise<LandingPageRecord[]> {
  return prisma.landingPage.findMany({
    orderBy: { url: "asc" },
  })
}

export async function listLandingPagesForProduct(
  productId: string
): Promise<LandingPageRecord[]> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      landingPages: {
        orderBy: { url: "asc" },
      },
    },
  })

  return product?.landingPages ?? []
}

export async function listAvailableLandingPagesForProduct(
  productId: string
): Promise<LandingPageRecord[]> {
  const [linked, all] = await Promise.all([
    listLandingPagesForProduct(productId),
    listLandingPages(),
  ])

  const linkedIds = new Set(linked.map((page) => page.id))
  return all.filter((page) => !linkedIds.has(page.id))
}

export async function getLandingPageById(
  id: string
): Promise<LandingPageRecord | null> {
  return prisma.landingPage.findUnique({ where: { id } })
}

export async function getLandingPageCampaignUsage(
  landingPageId: string
): Promise<LandingPageCampaignUsage[]> {
  const landing = await prisma.landingPage.findUnique({
    where: { id: landingPageId },
    select: { id: true, url: true },
  })
  if (!landing) return []

  const campaigns = await prisma.campaign.findMany({
    select: { id: true, name: true, config: true },
  })

  return campaigns
    .filter((campaign) => {
      const configLandingPageId = parseLandingPageIdFromConfig(campaign.config)
      const configLandingPageUrl = parseLandingPageUrlFromConfig(campaign.config)
      return (
        configLandingPageId === landing.id ||
        (configLandingPageUrl !== null && configLandingPageUrl === landing.url)
      )
    })
    .map((campaign) => ({ id: campaign.id, name: campaign.name }))
}

export async function createLandingPage(input: {
  url: string
}): Promise<LandingPageRecord> {
  const url = normalizeLandingPageUrl(input.url)
  if (!url) throw new Error("La URL no puede estar vacía")

  try {
    return await prisma.landingPage.create({
      data: { url },
    })
  } catch {
    throw new Error("Esa URL ya está registrada")
  }
}

export async function createLandingPageForProduct(input: {
  productId: string
  url: string
}): Promise<LandingPageRecord> {
  const url = normalizeLandingPageUrl(input.url)
  if (!url) throw new Error("La URL no puede estar vacía")

  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: { id: true },
  })
  if (!product) throw new Error("Producto no encontrado")

  const existing = await prisma.landingPage.findUnique({
    where: { url },
  })

  const landing =
    existing ??
    (await prisma.landingPage.create({
      data: { url },
    }))

  await prisma.product.update({
    where: { id: input.productId },
    data: {
      landingPages: {
        connect: { id: landing.id },
      },
    },
  })

  return landing
}

export async function linkLandingPageToProduct(input: {
  productId: string
  landingPageId: string
}): Promise<LandingPageRecord> {
  const [product, landing] = await Promise.all([
    prisma.product.findUnique({
      where: { id: input.productId },
      select: { id: true },
    }),
    prisma.landingPage.findUnique({
      where: { id: input.landingPageId },
    }),
  ])

  if (!product) throw new Error("Producto no encontrado")
  if (!landing) throw new Error("Landing page no encontrada")

  await prisma.product.update({
    where: { id: input.productId },
    data: {
      landingPages: {
        connect: { id: landing.id },
      },
    },
  })

  return landing
}

export async function updateLandingPage(input: {
  id: string
  url: string
}): Promise<LandingPageRecord> {
  const url = normalizeLandingPageUrl(input.url)
  if (!url) throw new Error("La URL no puede estar vacía")

  const existing = await prisma.landingPage.findUnique({
    where: { id: input.id },
    select: { id: true },
  })
  if (!existing) throw new Error("Landing page no encontrada")

  try {
    return await prisma.landingPage.update({
      where: { id: input.id },
      data: { url },
    })
  } catch {
    throw new Error("Esa URL ya está registrada")
  }
}

export async function unlinkLandingPageFromProduct(input: {
  productId: string
  landingPageId: string
}): Promise<void> {
  const usage = await getLandingPageCampaignUsage(input.landingPageId)
  if (usage.length > 0) {
    const names = usage.map((campaign) => campaign.name).join(", ")
    throw new Error(
      `No se puede eliminar: ${usage.length} campaña(s) usan esta landing page (${names})`
    )
  }

  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: { id: true },
  })
  if (!product) throw new Error("Producto no encontrado")

  await prisma.product.update({
    where: { id: input.productId },
    data: {
      landingPages: {
        disconnect: { id: input.landingPageId },
      },
    },
  })
}

export async function deleteLandingPage(id: string): Promise<void> {
  const usage = await getLandingPageCampaignUsage(id)
  if (usage.length > 0) {
    throw new Error(
      `No se puede eliminar: ${usage.length} campaña(s) usan esta landing page`
    )
  }

  await prisma.landingPage.delete({ where: { id } })
}
