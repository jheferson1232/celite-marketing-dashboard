import type { Prisma } from "@/app/generated/prisma/client"
import { Prisma as PrismaNamespace } from "@/app/generated/prisma/client"
import prisma, { resetPrismaClient } from "@/lib/prisma"
import { ServerActionError } from "@/lib/server-action"
import { mapPendingProductRow } from "./map-pending-product"
import {
  primaryPendingImageUrl,
  toPendingImageUrlsJson,
} from "./pending-product-images"
import type { PendingProductRecord } from "./types"
import { listPendingProducts } from "./list-pending-products"

export type AddManualPendingProductInput = {
  name: string
  dropiId?: string | null
  url?: string | null
  imageUrl?: string | null
  imageUrls?: string[]
  price?: number | null
}

function slugifyId(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
}

function resolveImageUrls(input: AddManualPendingProductInput): string[] {
  const merged = [
    ...(input.imageUrls ?? []),
    ...(input.imageUrl?.trim() ? [input.imageUrl.trim()] : []),
  ]
  return toPendingImageUrlsJson(merged)
}

function isStalePrismaClientError(error: unknown): boolean {
  return (
    error instanceof PrismaNamespace.PrismaClientValidationError &&
    error.message.includes("Unknown argument `imageUrls`")
  )
}

function formatPrismaUpsertError(error: unknown): string | null {
  if (!(error instanceof PrismaNamespace.PrismaClientValidationError)) {
    return null
  }

  const message = error.message
  if (
    message.includes("column `imageUrls`") &&
    message.includes("does not exist")
  ) {
    return (
      "Falta la columna imageUrls en la base de datos. Ejecuta " +
      "`pnpm exec prisma db push` y reinicia el servidor (`pnpm dev`)."
    )
  }

  const short =
    message
      .split("\n")
      .find(
        (line) =>
          line.includes("Unknown argument") || line.includes("does not exist")
      )
      ?.trim() ?? message.split("\n")[0]?.trim()

  return short || null
}

type UpsertPayload = {
  dropiId: string
  name: string
  url: string | null
  imageUrl: string | null
  imageUrlsJson: Prisma.InputJsonValue
  price: number | null
}

async function upsertManualProductRow(
  db: typeof prisma,
  payload: UpsertPayload
) {
  const { dropiId, name, url, imageUrl, imageUrlsJson, price } = payload

  return db.dropiFavoriteProduct.upsert({
    where: { dropiId },
    create: {
      dropiId,
      name,
      url,
      imageUrl,
      imageUrls: imageUrlsJson,
      price,
      status: "IMPORTED",
      lastSyncedAt: new Date(),
    },
    update: {
      name,
      url,
      imageUrl,
      imageUrls: imageUrlsJson,
      price,
      status: "IMPORTED",
      lastSyncedAt: new Date(),
      lastError: null,
    },
    include: { matches: { orderBy: { score: "desc" } } },
  })
}

export async function addManualPendingProduct(
  input: AddManualPendingProductInput
): Promise<PendingProductRecord> {
  const name = input.name.trim()
  if (!name) {
    throw new ServerActionError("El nombre del producto es obligatorio.")
  }

  const dropiId =
    input.dropiId?.trim() ||
    `manual-${slugifyId(name) || "producto"}-${Date.now()}`

  const price =
    input.price != null && Number.isFinite(input.price)
      ? Math.max(0, input.price)
      : null

  const imageUrls = resolveImageUrls(input)
  const imageUrl = primaryPendingImageUrl(imageUrls)
  const payload: UpsertPayload = {
    dropiId,
    name,
    url: input.url?.trim() || null,
    imageUrl,
    imageUrlsJson: imageUrls as Prisma.InputJsonValue,
    price,
  }

  let row
  try {
    row = await upsertManualProductRow(prisma, payload)
  } catch (error) {
    if (isStalePrismaClientError(error)) {
      row = await upsertManualProductRow(resetPrismaClient(), payload)
    } else {
      const friendly = formatPrismaUpsertError(error)
      if (friendly) throw new ServerActionError(friendly)
      throw error
    }
  }

  return mapPendingProductRow(row)
}

export async function addManualPendingProductAndList(
  input: AddManualPendingProductInput
): Promise<{ product: PendingProductRecord; products: PendingProductRecord[] }> {
  const product = await addManualPendingProduct(input)
  const products = await listPendingProducts()
  return { product, products }
}
