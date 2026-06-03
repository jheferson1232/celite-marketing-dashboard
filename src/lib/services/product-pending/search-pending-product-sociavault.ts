import type { Prisma } from "@/app/generated/prisma/client"
import prisma from "@/lib/prisma"
import { ServerActionError } from "@/lib/server-action"
import { getSociaVaultSearchConfig } from "@/lib/services/sociavault/sociavault-config"
import { searchSociaVaultMatchesWithOutcome } from "@/lib/services/sociavault/search-pending-matches"
import { deletePendingMatchBlobsForProduct } from "./delete-pending-match-blobs"
import { mapPendingProductRow } from "./map-pending-product"
import {
  buildPendingMatchExclusionSet,
  exclusionTokensFromDbRow,
  filterNewPendingMatchCandidates,
} from "./pending-match-exclusion"
import { parsePendingImageUrls } from "./pending-product-images"
import { persistPendingMatchCandidatesMedia } from "./persist-pending-match-media"
import type { PendingProductRecord } from "./types"

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  return "Error al buscar en SociaVault"
}

export async function searchPendingProductInSociaVault(
  productId: string
): Promise<PendingProductRecord> {
  const product = await prisma.dropiFavoriteProduct.findUnique({
    where: { id: productId },
    include: { matches: true },
  })

  if (!product) {
    throw new ServerActionError("Producto no encontrado.")
  }

  const previousMatches = product.matches
  const excluded = buildPendingMatchExclusionSet(
    previousMatches.map((row) => exclusionTokensFromDbRow(row))
  )
  const excludeMatchKeys = [...excluded]
  const hadPreviousResults = previousMatches.length > 0
  const config = getSociaVaultSearchConfig()

  await prisma.dropiFavoriteProduct.update({
    where: { id: productId },
    data: { status: "SEARCHING", lastError: null },
  })

  try {
    const imageUrls = parsePendingImageUrls(product.imageUrls, product.imageUrl)
    const { matches: rawCandidates, warnings } =
      await searchSociaVaultMatchesWithOutcome({
        name: product.name,
        imageUrls,
        searchProfile: "pending",
        excludeMatchKeys: excludeMatchKeys.length > 0 ? excludeMatchKeys : undefined,
        tiktokParseLimit:
          excludeMatchKeys.length > 0
            ? config.maxMatchesPerPlatform * 3
            : undefined,
      })

    const freshCandidates = filterNewPendingMatchCandidates(rawCandidates, excluded)

    const candidates = await persistPendingMatchCandidatesMedia(
      productId,
      freshCandidates
    )

    const notice =
      warnings.length > 0
        ? warnings
            .filter((w) => !/Meta Ad Library|facebook-ad-library/i.test(w))
            .join(" ") || null
        : null
    const outOfCredits = warnings.some((w) =>
      /insufficient credits|créditos/i.test(w)
    )

    const baulMatchIds = previousMatches
      .filter((row) => row.isFavorite)
      .map((row) => row.id)

    if (baulMatchIds.length > 0) {
      await deletePendingMatchBlobsForProduct(productId, {
        keepMatchIds: baulMatchIds,
      })
    } else {
      await deletePendingMatchBlobsForProduct(productId)
    }

    await prisma.productPendingMatch.deleteMany({
      where: {
        favoriteId: productId,
        isFavorite: false,
      },
    })

    const keptBaulCount = baulMatchIds.length

    if (candidates.length > 0 || keptBaulCount > 0) {
      await prisma.productPendingMatch.createMany({
        data: candidates.map((match, index) => ({
          favoriteId: productId,
          matchType: match.matchType,
          externalId:
            match.externalId ??
            `${match.matchType}-${index}-${match.title ?? "item"}`.slice(0, 120),
          title: match.title,
          pageName: match.pageName,
          score: match.score,
          previewUrl: match.previewUrl,
          landingUrl: match.landingUrl,
          payload: {
            ...(match.payload as Record<string, unknown>),
            platform: match.platform,
            searchQuery: match.searchQuery,
          } as Prisma.InputJsonValue,
        })),
        skipDuplicates: true,
      })

      const noNewVideos =
        candidates.length === 0 && hadPreviousResults && keptBaulCount > 0

      await prisma.dropiFavoriteProduct.update({
        where: { id: productId },
        data: {
          status: "MATCHED",
          lastSyncedAt: new Date(),
          lastError: noNewVideos
            ? "No hay videos nuevos en esta búsqueda. Los del baúl se mantienen en el carrusel."
            : notice,
        },
      })
    } else {
      await prisma.dropiFavoriteProduct.update({
        where: { id: productId },
        data: {
          status: outOfCredits ? "ERROR" : "NO_MATCH",
          lastSyncedAt: new Date(),
          lastError:
            notice ??
            (hadPreviousResults
              ? "No hay videos nuevos; prueba de nuevo más tarde o revisa el nombre del producto."
              : null) ??
            (outOfCredits
              ? "Sin créditos SociaVault. Recarga en https://sociavault.com/dashboard"
              : null),
        },
      })
      if (outOfCredits) {
        throw new ServerActionError(
          "Sin créditos SociaVault. Recarga tu cuenta y vuelve a buscar."
        )
      }
    }
  } catch (error) {
    const message = errorMessage(error)
    await prisma.dropiFavoriteProduct.update({
      where: { id: productId },
      data: {
        status: "ERROR",
        lastError: message,
        lastSyncedAt: new Date(),
      },
    })
    throw new ServerActionError(message)
  }

  const updated = await prisma.dropiFavoriteProduct.findUnique({
    where: { id: productId },
    include: { matches: { orderBy: { score: "desc" } } },
  })

  if (!updated) {
    throw new ServerActionError("Producto no encontrado tras la búsqueda.")
  }

  return mapPendingProductRow(updated)
}

export async function searchPendingProductsInSociaVault(
  productIds: string[]
): Promise<{ searched: number; matched: number; noMatch: number; errors: number }> {
  let searched = 0
  let matched = 0
  let noMatch = 0
  let errors = 0

  for (const productId of productIds) {
    searched++
    try {
      const result = await searchPendingProductInSociaVault(productId)
      if (result.status === "MATCHED") matched++
      else if (result.status === "NO_MATCH") noMatch++
      else if (result.status === "ERROR") errors++
    } catch {
      errors++
    }
  }

  return { searched, matched, noMatch, errors }
}
