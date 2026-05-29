import { Prisma } from "@/app/generated/prisma/client"
import prisma from "@/lib/prisma"
import { ServerActionError } from "@/lib/server-action"
import { scrapeDropiFavorites } from "@/lib/services/dropi/dropi-scraper"
import {
  primaryPendingImageUrl,
  toPendingImageUrlsJson,
} from "./pending-product-images"
import type { PendingSyncSummary } from "./types"

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  return "Error desconocido"
}

export type SyncPendingOptions = {
  /** Importa solo favoritos cuyo nombre coincida con este texto (ej. "Tenis Vans Sb"). */
  keyword?: string
}

export async function syncPendingProductsNow(
  options?: SyncPendingOptions
): Promise<PendingSyncSummary> {
  const run = await prisma.pendingSyncRun.create({
    data: { status: "running" },
  })

  let imported = 0
  let searched = 0
  let matched = 0
  let noMatch = 0
  let errors = 0
  let source: PendingSyncSummary["source"] = "playwright"

  try {
    const scrape = await scrapeDropiFavorites({
      keyword: options?.keyword,
    })
    source = scrape.source

    const importedDropiIds: string[] = []

    if (options?.keyword?.trim() && scrape.favorites.length === 0) {
      throw new ServerActionError(
        `No se encontró "${options.keyword.trim()}" en Dropi para importar.`
      )
    }

    for (const favorite of scrape.favorites) {
      const imageUrls = toPendingImageUrlsJson(
        favorite.imageUrl ? [favorite.imageUrl] : []
      )
      const imageUrl = primaryPendingImageUrl(imageUrls)
      const imageUrlsJson = imageUrls as Prisma.InputJsonValue

      await prisma.dropiFavoriteProduct.upsert({
        where: { dropiId: favorite.dropiId },
        create: {
          dropiId: favorite.dropiId,
          name: favorite.name,
          url: favorite.url,
          imageUrl,
          imageUrls: imageUrlsJson,
          sku: favorite.sku,
          price: favorite.price,
          status: "IMPORTED",
          lastSyncedAt: new Date(),
        },
        update: {
          name: favorite.name,
          url: favorite.url,
          imageUrl,
          imageUrls: imageUrlsJson,
          sku: favorite.sku,
          price: favorite.price,
          lastSyncedAt: new Date(),
          lastError: null,
        },
      })
      imported++
      importedDropiIds.push(favorite.dropiId)
    }

    await prisma.pendingSyncRun.update({
      where: { id: run.id },
      data: {
        status: "completed",
        finishedAt: new Date(),
        imported,
        searched,
        matched,
        noMatch,
        errors,
      },
    })

    return {
      runId: run.id,
      imported,
      searched,
      matched,
      noMatch,
      errors,
      source,
    }
  } catch (error) {
    const message = errorMessage(error)
    await prisma.pendingSyncRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        imported,
        searched,
        matched,
        noMatch,
        errors: errors + 1,
        errorMessage: message,
      },
    })
    throw error
  }
}
