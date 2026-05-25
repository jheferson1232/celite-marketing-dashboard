import prisma from "@/lib/prisma"
import {
  deleteCreativeMedia,
  uploadCreativeMedia,
} from "@/lib/services/blob/creative-media"

export type CreativeType = "image" | "video"

export type CreativeVariantSummary = {
  id: string
  name: string
  product: { id: string; name: string }
}

export type CreativeRecord = {
  id: string
  url: string
  type: CreativeType
  name: string | null
  createdAt: Date
  updatedAt: Date
  variants: CreativeVariantSummary[]
}

const creativeInclude = {
  variants: {
    select: {
      id: true,
      name: true,
      product: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" as const },
  },
} as const

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

function sanitizeName(name: string | null | undefined): string | null {
  const trimmed = name?.trim()
  return trimmed ? trimmed : null
}

export async function listCreatives(): Promise<CreativeRecord[]> {
  return prisma.creative.findMany({
    include: creativeInclude,
    orderBy: { updatedAt: "desc" },
  })
}

export async function getCreativeById(id: string): Promise<CreativeRecord | null> {
  return prisma.creative.findUnique({
    where: { id },
    include: creativeInclude,
  })
}

export async function findCreativeByUrl(url: string): Promise<CreativeRecord | null> {
  const trimmed = url.trim()
  if (!trimmed) return null

  return prisma.creative.findUnique({
    where: { url: trimmed },
    include: creativeInclude,
  })
}

export async function createCreativeFromUpload(input: {
  type: CreativeType
  file: File
  name?: string | null
  variantIds?: string[]
}): Promise<CreativeRecord> {
  const variantIds = sanitizeIdList(input.variantIds)
  const [url] = await uploadCreativeMedia({
    type: input.type,
    files: [input.file],
  })

  if (!url) throw new Error("No se pudo subir el archivo")

  try {
    return await prisma.creative.create({
      data: {
        url,
        type: input.type,
        name: sanitizeName(input.name),
        ...(variantIds.length > 0
          ? {
              variants: {
                connect: variantIds.map((id) => ({ id })),
              },
            }
          : {}),
      },
      include: creativeInclude,
    })
  } catch {
    await deleteCreativeMedia(url)
    throw new Error("Ese archivo ya está registrado como creative")
  }
}

export async function createCreativeFromUrl(input: {
  url: string
  type: CreativeType
  name?: string | null
  variantIds?: string[]
}): Promise<CreativeRecord> {
  const url = input.url.trim()
  if (!url) throw new Error("La URL no puede estar vacía")

  const variantIds = sanitizeIdList(input.variantIds)
  const existing = await findCreativeByUrl(url)

  if (existing) {
    if (variantIds.length === 0) return existing
    return attachCreativeToVariants(existing.id, variantIds)
  }

  try {
    return await prisma.creative.create({
      data: {
        url,
        type: input.type,
        name: sanitizeName(input.name),
        ...(variantIds.length > 0
          ? {
              variants: {
                connect: variantIds.map((id) => ({ id })),
              },
            }
          : {}),
      },
      include: creativeInclude,
    })
  } catch {
    throw new Error("Ese archivo ya está registrado como creative")
  }
}

export async function updateCreative(input: {
  id: string
  name?: string | null
}): Promise<CreativeRecord> {
  const existing = await prisma.creative.findUnique({
    where: { id: input.id },
    select: { id: true },
  })
  if (!existing) throw new Error("Creative no encontrado")

  return prisma.creative.update({
    where: { id: input.id },
    data: {
      ...(input.name !== undefined ? { name: sanitizeName(input.name) } : {}),
    },
    include: creativeInclude,
  })
}

export async function setCreativeVariants(
  creativeId: string,
  variantIds: string[]
): Promise<CreativeRecord> {
  const existing = await prisma.creative.findUnique({
    where: { id: creativeId },
    select: { id: true },
  })
  if (!existing) throw new Error("Creative no encontrado")

  const nextVariantIds = sanitizeIdList(variantIds)

  return prisma.creative.update({
    where: { id: creativeId },
    data: {
      variants: {
        set: nextVariantIds.map((id) => ({ id })),
      },
    },
    include: creativeInclude,
  })
}

export async function attachCreativeToVariants(
  creativeId: string,
  variantIds: string[]
): Promise<CreativeRecord> {
  const ids = sanitizeIdList(variantIds)
  if (ids.length === 0) {
    const creative = await getCreativeById(creativeId)
    if (!creative) throw new Error("Creative no encontrado")
    return creative
  }

  const existing = await prisma.creative.findUnique({
    where: { id: creativeId },
    select: { id: true },
  })
  if (!existing) throw new Error("Creative no encontrado")

  return prisma.creative.update({
    where: { id: creativeId },
    data: {
      variants: {
        connect: ids.map((id) => ({ id })),
      },
    },
    include: creativeInclude,
  })
}

export async function detachCreativeFromVariant(
  creativeId: string,
  variantId: string
): Promise<CreativeRecord> {
  const existing = await prisma.creative.findUnique({
    where: { id: creativeId },
    select: { id: true },
  })
  if (!existing) throw new Error("Creative no encontrado")

  return prisma.creative.update({
    where: { id: creativeId },
    data: {
      variants: {
        disconnect: { id: variantId },
      },
    },
    include: creativeInclude,
  })
}

export async function deleteCreative(id: string): Promise<void> {
  const existing = await prisma.creative.findUnique({
    where: { id },
    select: { url: true },
  })
  if (!existing) return

  await prisma.creative.delete({ where: { id } })
  await deleteCreativeMedia(existing.url)
}
