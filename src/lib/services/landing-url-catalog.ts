import prisma from "@/lib/prisma"

export type LandingUrlCatalogEntry = {
  id: string
  url: string
  label: string | null
  createdAt: Date
  updatedAt: Date
}

function normalizeCatalogUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed
  }
  return `https://${trimmed}`
}

export async function listLandingUrlCatalog(): Promise<LandingUrlCatalogEntry[]> {
  return prisma.landingUrlCatalog.findMany({
    orderBy: { url: "asc" },
  })
}

export async function createLandingUrlCatalogEntry(input: {
  url: string
  label?: string | null
}): Promise<LandingUrlCatalogEntry> {
  const url = normalizeCatalogUrl(input.url)
  if (!url) throw new Error("La URL no puede estar vacía")

  try {
    return await prisma.landingUrlCatalog.create({
      data: {
        url,
        label: input.label?.trim() || null,
      },
    })
  } catch {
    throw new Error("Esa URL ya está guardada en el catálogo")
  }
}

export async function deleteLandingUrlCatalogEntry(
  id: string
): Promise<void> {
  await prisma.landingUrlCatalog.delete({ where: { id } })
}

function parseUrlLines(raw: string): string[] {
  const seen = new Set<string>()
  const urls: string[] = []

  for (const line of raw.split("\n")) {
    const url = normalizeCatalogUrl(line)
    if (!url) continue
    const key = url.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    urls.push(url)
  }

  return urls
}

export type BulkSyncLandingUrlCatalogResult = {
  urls: string[]
  created: number
  removed: number
}

/** Reemplaza el catálogo global con las líneas del textarea (una URL por línea). */
export async function syncLandingUrlCatalogFromText(
  raw: string
): Promise<BulkSyncLandingUrlCatalogResult> {
  const urls = parseUrlLines(raw)
  const existing = await prisma.landingUrlCatalog.findMany()
  const desiredKeys = new Set(urls.map((u) => u.toLowerCase()))
  const existingByKey = new Map(
    existing.map((entry) => [entry.url.toLowerCase(), entry])
  )

  const toCreate = urls.filter((url) => !existingByKey.has(url.toLowerCase()))
  const toRemove = existing.filter(
    (entry) => !desiredKeys.has(entry.url.toLowerCase())
  )

  if (toCreate.length > 0) {
    await prisma.landingUrlCatalog.createMany({
      data: toCreate.map((url) => ({ url })),
      skipDuplicates: true,
    })
  }

  if (toRemove.length > 0) {
    await prisma.landingUrlCatalog.deleteMany({
      where: { id: { in: toRemove.map((e) => e.id) } },
    })
  }

  return {
    urls,
    created: toCreate.length,
    removed: toRemove.length,
  }
}
