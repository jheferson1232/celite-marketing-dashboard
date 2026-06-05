import type { Prisma } from "@/app/generated/prisma/client"
import prisma from "@/lib/prisma"
import { ServerActionError } from "@/lib/server-action"
import { searchStoreMetaAds } from "@/lib/services/sociavault/search-store-meta"
import { mapStorePendingDetailRow } from "./map-store-pending"
import type { StorePendingDetailRecord } from "./types"

function parseDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  return "Error al scrapear Meta Ad Library"
}

export async function scrapeStorePendingMeta(
  storeId: string
): Promise<StorePendingDetailRecord> {
  const store = await prisma.storePending.findUnique({
    where: { id: storeId },
  })

  if (!store) {
    throw new ServerActionError("Tienda no encontrada.")
  }

  const syncRun = await prisma.storePendingSyncRun.create({
    data: {
      storeId,
      status: "running",
    },
  })

  await prisma.storePending.update({
    where: { id: storeId },
    data: { status: "SEARCHING", lastError: null },
  })

  try {
    const outcome = await searchStoreMetaAds({
      name: store.name,
      domain: store.domain,
      pageUrl: store.pageUrl,
      country: store.country,
      metaPageId: store.metaPageId,
    })

    const outOfCredits = outcome.warnings.some((warning) =>
      /insufficient credits|créditos/i.test(warning)
    )

    if (outcome.creatives.length === 0) {
      await prisma.storePendingSyncRun.update({
        where: { id: syncRun.id },
        data: {
          status: outOfCredits ? "error" : "completed",
          finishedAt: new Date(),
          creditsUsed: outcome.creditsUsed,
          adsFound: 0,
          errorMessage:
            outcome.warnings.join(" ") ||
            (outOfCredits
              ? "Sin créditos SociaVault."
              : "Sin anuncios Meta para esta tienda."),
        },
      })

      await prisma.storePending.update({
        where: { id: storeId },
        data: {
          status: outOfCredits ? "ERROR" : "NO_MATCH",
          lastSyncedAt: new Date(),
          lastError:
            outcome.warnings.join(" ") ||
            (outOfCredits
              ? "Sin créditos SociaVault. Recarga en https://sociavault.com/dashboard"
              : "Sin anuncios Meta para esta tienda."),
          metaPageId: outcome.metaPageId ?? store.metaPageId,
          logoUrl: outcome.logoUrl ?? store.logoUrl,
        },
      })

      if (outOfCredits) {
        throw new ServerActionError(
          "Sin créditos SociaVault. Recarga tu cuenta y vuelve a scrapear."
        )
      }

      const detail = await prisma.storePending.findUnique({
        where: { id: storeId },
        include: {
          snapshots: { orderBy: { createdAt: "desc" }, take: 12 },
          creatives: {
            orderBy: [{ isActive: "desc" }, { score: "desc" }],
            take: 60,
          },
          _count: { select: { creatives: true } },
        },
      })

      if (!detail) {
        throw new ServerActionError("Tienda no encontrada tras el scrape.")
      }

      return mapStorePendingDetailRow(detail)
    }

    const snapshot = await prisma.storePendingSnapshot.create({
      data: {
        storeId,
        activeAds: outcome.activeAds,
        totalAds: outcome.totalAds,
        creativesSaved: outcome.creatives.length,
        topCountries: outcome.topCountries as Prisma.InputJsonValue,
        searchQuery: outcome.searchQuery,
        metaPageId: outcome.metaPageId,
        payload: {
          warnings: outcome.warnings,
          creditsUsed: outcome.creditsUsed,
        } as Prisma.InputJsonValue,
      },
    })

    await prisma.storePendingCreative.deleteMany({
      where: { storeId },
    })

    await prisma.storePendingCreative.createMany({
      data: outcome.creatives.map((creative, index) => ({
        storeId,
        snapshotId: snapshot.id,
        externalId:
          creative.externalId ??
          `meta-ad-${index}-${creative.title ?? "item"}`.slice(0, 120),
        title: creative.title,
        pageName: creative.pageName,
        previewUrl: creative.previewUrl,
        landingUrl: creative.landingUrl,
        isActive: creative.isActive,
        mediaType: creative.mediaType,
        startDate: parseDate(creative.startDate),
        endDate: parseDate(creative.endDate),
        score: creative.score,
        payload: creative.payload as Prisma.InputJsonValue,
      })),
      skipDuplicates: true,
    })

    await prisma.storePendingSyncRun.update({
      where: { id: syncRun.id },
      data: {
        status: "completed",
        finishedAt: new Date(),
        creditsUsed: outcome.creditsUsed,
        adsFound: outcome.creatives.length,
        errorMessage:
          outcome.warnings.length > 0 ? outcome.warnings.join(" ") : null,
      },
    })

    await prisma.storePending.update({
      where: { id: storeId },
      data: {
        status: "MATCHED",
        lastSyncedAt: new Date(),
        lastError: outcome.warnings.length > 0 ? outcome.warnings.join(" ") : null,
        metaPageId: outcome.metaPageId ?? store.metaPageId,
        logoUrl: outcome.logoUrl ?? store.logoUrl,
      },
    })
  } catch (error) {
    const message = errorMessage(error)

    await prisma.storePendingSyncRun.update({
      where: { id: syncRun.id },
      data: {
        status: "error",
        finishedAt: new Date(),
        errorMessage: message,
      },
    })

    await prisma.storePending.update({
      where: { id: storeId },
      data: {
        status: "ERROR",
        lastSyncedAt: new Date(),
        lastError: message,
      },
    })

    throw new ServerActionError(message)
  }

  const updated = await prisma.storePending.findUnique({
    where: { id: storeId },
    include: {
      snapshots: { orderBy: { createdAt: "desc" }, take: 12 },
      creatives: {
        orderBy: [{ isActive: "desc" }, { score: "desc" }],
        take: 60,
      },
      _count: { select: { creatives: true } },
    },
  })

  if (!updated) {
    throw new ServerActionError("Tienda no encontrada tras el scrape.")
  }

  return mapStorePendingDetailRow(updated)
}
