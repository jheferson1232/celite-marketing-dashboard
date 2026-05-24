import prisma from "@/lib/prisma"

export type LandingPageRecord = {
  id: string
  url: string
  createdAt: Date
  updatedAt: Date
}

function normalizeLandingPageUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed
  }
  return `https://${trimmed}`
}

export async function listLandingPages(): Promise<LandingPageRecord[]> {
  return prisma.landingPage.findMany({
    orderBy: { url: "asc" },
  })
}

export async function getLandingPageById(
  id: string
): Promise<LandingPageRecord | null> {
  return prisma.landingPage.findUnique({ where: { id } })
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

export async function deleteLandingPage(id: string): Promise<void> {
  await prisma.landingPage.delete({ where: { id } })
}
