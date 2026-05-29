import type { Prisma } from "@/app/generated/prisma/client"
import prisma from "@/lib/prisma"
import { ServerActionError } from "@/lib/server-action"

export async function savePendingMatchMedia(
  matchId: string,
  media: { coverUrl?: string | null; videoUrl?: string | null }
): Promise<{ id: string }> {
  const match = await prisma.productPendingMatch.findUnique({
    where: { id: matchId },
    select: { id: true, previewUrl: true, payload: true },
  })

  if (!match) {
    throw new ServerActionError("Video no encontrado.")
  }

  const payload = (match.payload ?? {}) as Record<string, unknown>
  const coverUrl = media.coverUrl ?? match.previewUrl ?? pickPayloadString(payload, "coverUrl")
  const videoUrl = media.videoUrl ?? pickPayloadString(payload, "videoUrl")

  await prisma.productPendingMatch.update({
    where: { id: matchId },
    data: {
      previewUrl: coverUrl,
      payload: {
        ...payload,
        ...(coverUrl ? { coverUrl } : {}),
        ...(videoUrl ? { videoUrl } : {}),
      } as Prisma.InputJsonValue,
    },
  })

  return { id: matchId }
}

function pickPayloadString(
  payload: Record<string, unknown>,
  key: string
): string | null {
  const value = payload[key]
  return typeof value === "string" && value.trim() ? value.trim() : null
}
