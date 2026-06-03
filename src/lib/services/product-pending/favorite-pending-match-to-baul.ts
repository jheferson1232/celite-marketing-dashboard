import type { Prisma } from "@/app/generated/prisma/client"
import prisma from "@/lib/prisma"
import { ServerActionError } from "@/lib/server-action"
import {
  attachCreativeToVariants,
  createCreativeFromUrl,
  findCreativeByUrl,
} from "@/lib/services/creative"
import { parseMatchDisplay } from "./parse-match-display"
import type { PendingProductMatchRecord } from "./types"

function mapMatchRow(match: {
  id: string
  matchType: string
  externalId: string | null
  title: string | null
  pageName: string | null
  score: number
  previewUrl: string | null
  landingUrl: string | null
  payload: unknown
  isFavorite: boolean
  createdAt: Date
}): PendingProductMatchRecord {
  const payload =
    match.payload && typeof match.payload === "object" && !Array.isArray(match.payload)
      ? (match.payload as Record<string, unknown>)
      : {}

  return {
    id: match.id,
    matchType: match.matchType === "video" ? "video" : "campaign",
    externalId: match.externalId,
    title: match.title,
    pageName: match.pageName,
    score: match.score,
    previewUrl: match.previewUrl,
    landingUrl: match.landingUrl,
    payload,
    isFavorite: match.isFavorite,
    createdAt: match.createdAt,
  }
}

function buildCreativeName(match: PendingProductMatchRecord): string | null {
  const info = parseMatchDisplay(match)
  const author = info.pageName ?? info.authorHandle
  const caption = info.bodyText?.trim()
  if (author && caption) {
    return `${author} — ${caption.slice(0, 80)}`
  }
  return match.title?.trim() ?? author ?? caption?.slice(0, 120) ?? null
}

function uniqueVariantIds(variantIds: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of variantIds) {
    const id = raw.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    result.push(id)
  }
  return result
}

export async function favoritePendingMatchToBaul(
  matchId: string,
  variantIds: string[]
): Promise<{ id: string; isFavorite: boolean; creativeId: string }> {
  const ids = uniqueVariantIds(variantIds)
  if (ids.length === 0) {
    throw new ServerActionError("Selecciona al menos una variante.")
  }

  const found = await prisma.productVariant.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  })

  if (found.length !== ids.length) {
    throw new ServerActionError("Una o más variantes no existen en el catálogo.")
  }

  const row = await prisma.productPendingMatch.findUnique({
    where: { id: matchId },
  })

  if (!row) {
    throw new ServerActionError("Video no encontrado.")
  }

  const match = mapMatchRow(row)
  const info = parseMatchDisplay(match)
  const videoUrl = info.videoUrl?.trim()

  if (!videoUrl) {
    throw new ServerActionError(
      "Este video no tiene archivo disponible. Vuelve a buscar en SociaVault."
    )
  }

  const creativeName = buildCreativeName(match)
  const existing = await findCreativeByUrl(videoUrl)

  const creative = existing
    ? await attachCreativeToVariants(existing.id, ids)
    : await createCreativeFromUrl({
        url: videoUrl,
        type: "video",
        name: creativeName,
        variantIds: ids,
      })

  const payload = { ...match.payload }
  payload.baulCreativeId = creative.id
  payload.baulVariantIds = ids
  delete payload.baulVariantId

  await prisma.productPendingMatch.update({
    where: { id: matchId },
    data: {
      isFavorite: true,
      payload: payload as Prisma.InputJsonValue,
    },
  })

  return { id: matchId, isFavorite: true, creativeId: creative.id }
}
