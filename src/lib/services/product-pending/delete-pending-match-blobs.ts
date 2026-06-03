import prisma from "@/lib/prisma"
import { deleteProductMedia } from "@/lib/services/blob/product-media"
import { isVercelBlobUrl } from "@/lib/services/blob/persist-remote-media"
import { collectBlobUrlsFromMatchPayload } from "./persist-pending-match-media"

function uniqueBlobUrls(urls: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const url of urls) {
    if (!isVercelBlobUrl(url) || seen.has(url)) continue
    seen.add(url)
    result.push(url)
  }
  return result
}

export function blobUrlsFromPendingMatchRow(match: {
  previewUrl: string | null
  payload: unknown
}): string[] {
  const urls = [
    ...(match.previewUrl ? [match.previewUrl] : []),
    ...collectBlobUrlsFromMatchPayload(match.payload),
  ]
  return uniqueBlobUrls(urls)
}

export async function deletePendingMatchBlobsForProduct(
  productId: string,
  options?: { keepMatchIds?: string[] }
): Promise<void> {
  const keepIds = options?.keepMatchIds?.filter(Boolean) ?? []
  const matches = await prisma.productPendingMatch.findMany({
    where: {
      favoriteId: productId,
      ...(keepIds.length > 0 ? { id: { notIn: keepIds } } : {}),
    },
    select: { previewUrl: true, payload: true },
  })

  const urls = uniqueBlobUrls(
    matches.flatMap((m) => blobUrlsFromPendingMatchRow(m))
  )

  if (urls.length > 0) {
    await deleteProductMedia(urls)
  }
}

export async function deletePendingMatchBlobs(matchId: string): Promise<void> {
  const match = await prisma.productPendingMatch.findUnique({
    where: { id: matchId },
    select: { previewUrl: true, payload: true },
  })

  if (!match) return

  const urls = blobUrlsFromPendingMatchRow(match)
  if (urls.length > 0) {
    await deleteProductMedia(urls)
  }
}
