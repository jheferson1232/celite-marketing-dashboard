import { Prisma } from "@/app/generated/prisma/client"
import prisma from "@/lib/prisma"

export type MetaLibraryEntryRecord = {
  id: string
  url: string | null
  facebookPage: string | null
  createdAt: string
  updatedAt: string
}

export type MetaLibraryEntryInput = {
  url?: string | null
  facebookPage?: string | null
}

function toRecord(row: {
  id: string
  url: string | null
  facebookPage: string | null
  createdAt: Date
  updatedAt: Date
}): MetaLibraryEntryRecord {
  return {
    id: row.id,
    url: row.url,
    facebookPage: row.facebookPage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function normalizeUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim() ?? ""
  if (!trimmed) return null
  try {
    const parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`)
    return parsed.toString()
  } catch {
    throw new Error("La URL de la tienda no es válida")
  }
}

function normalizeFacebookPage(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim() ?? ""
  return trimmed || null
}

function normalizeInput(input: MetaLibraryEntryInput): {
  url: string | null
  facebookPage: string | null
} {
  const url = normalizeUrl(input.url)
  const facebookPage = normalizeFacebookPage(input.facebookPage)

  if (!url && !facebookPage) {
    throw new Error("Indica al menos la tienda o la página de Facebook")
  }

  return { url, facebookPage }
}

export async function listMetaLibraryEntries(): Promise<MetaLibraryEntryRecord[]> {
  const rows = await prisma.metaLibraryEntry.findMany({
    orderBy: { updatedAt: "desc" },
  })
  return rows.map(toRecord)
}

export async function getMetaLibraryEntry(
  id: string
): Promise<MetaLibraryEntryRecord | null> {
  const row = await prisma.metaLibraryEntry.findUnique({ where: { id } })
  return row ? toRecord(row) : null
}

export async function createMetaLibraryEntry(
  input: MetaLibraryEntryInput
): Promise<MetaLibraryEntryRecord> {
  const data = normalizeInput(input)
  const row = await prisma.metaLibraryEntry.create({ data })
  return toRecord(row)
}

export async function updateMetaLibraryEntry(
  id: string,
  input: MetaLibraryEntryInput
): Promise<MetaLibraryEntryRecord> {
  const data = normalizeInput(input)
  const row = await prisma.metaLibraryEntry.update({
    where: { id },
    data: {
      ...data,
      lastSyncedAt: null,
      syncWarning: null,
      activeCount: null,
      totalCount: null,
      companyData: Prisma.JsonNull,
      adsData: Prisma.JsonNull,
      previewSlidesData: Prisma.JsonNull,
    },
  })
  return toRecord(row)
}

export async function deleteMetaLibraryEntry(id: string): Promise<void> {
  await prisma.metaLibraryEntry.delete({ where: { id } })
}
