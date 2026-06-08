import prisma from "@/lib/prisma"

export type MetaCommentProductRecord = {
  id: string
  name: string
  description: string
  imageUrl: string | null
  tags: string[]
  active: boolean
  createdAt: string
  updatedAt: string
}

export type MetaCommentProductInput = {
  name: string
  description: string
  imageUrl?: string | null
  tags?: string[]
  active?: boolean
}

function parseTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((t): t is string => typeof t === "string")
}

function toRecord(row: {
  id: string
  name: string
  description: string
  imageUrl: string | null
  tags: unknown
  active: boolean
  createdAt: Date
  updatedAt: Date
}): MetaCommentProductRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    imageUrl: row.imageUrl,
    tags: parseTags(row.tags),
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listMetaCommentProducts(): Promise<
  MetaCommentProductRecord[]
> {
  const rows = await prisma.metaCommentProduct.findMany({
    orderBy: { updatedAt: "desc" },
  })
  return rows.map(toRecord)
}

export async function listActiveMetaCommentProducts(): Promise<
  MetaCommentProductRecord[]
> {
  const rows = await prisma.metaCommentProduct.findMany({
    where: { active: true },
    orderBy: { updatedAt: "desc" },
  })
  return rows.map(toRecord)
}

export async function getMetaCommentProduct(
  id: string
): Promise<MetaCommentProductRecord | null> {
  const row = await prisma.metaCommentProduct.findUnique({ where: { id } })
  return row ? toRecord(row) : null
}

export async function createMetaCommentProduct(
  input: MetaCommentProductInput
): Promise<MetaCommentProductRecord> {
  const row = await prisma.metaCommentProduct.create({
    data: {
      name: input.name.trim(),
      description: input.description.trim(),
      imageUrl: input.imageUrl ?? null,
      tags: input.tags ?? [],
      active: input.active ?? true,
    },
  })
  return toRecord(row)
}

export async function updateMetaCommentProduct(
  id: string,
  input: MetaCommentProductInput
): Promise<MetaCommentProductRecord> {
  const row = await prisma.metaCommentProduct.update({
    where: { id },
    data: {
      name: input.name.trim(),
      description: input.description.trim(),
      imageUrl: input.imageUrl ?? null,
      tags: input.tags ?? [],
      active: input.active ?? true,
    },
  })
  return toRecord(row)
}

export async function deleteMetaCommentProduct(id: string): Promise<void> {
  await prisma.metaCommentProduct.delete({ where: { id } })
}
