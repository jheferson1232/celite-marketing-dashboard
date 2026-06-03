import type { Prisma } from "@/app/generated/prisma/client"
import prisma from "@/lib/prisma"
import { ServerActionError } from "@/lib/server-action"
import { isVercelBlobUrl } from "@/lib/services/blob/persist-remote-media"
import {
  buildScrapedMediaPath,
  persistRemoteMediaToBlob,
} from "@/lib/services/blob/persist-remote-media"

export async function savePendingMatchMedia(
  matchId: string,
  media: { coverUrl?: string | null; videoUrl?: string | null }
): Promise<{ id: string }> {
  const match = await prisma.productPendingMatch.findUnique({
    where: { id: matchId },
    select: { id: true, favoriteId: true, previewUrl: true, payload: true },
  })

  if (!match) {
    throw new ServerActionError("Video no encontrado.")
  }

  const payload = (match.payload ?? {}) as Record<string, unknown>
  const platform =
    payload.platform === "instagram" || payload.platform === "tiktok"
      ? payload.platform
      : "tiktok"
  const externalId =
    pickPayloadString(payload, "aweme_id") ??
    pickPayloadString(payload, "id") ??
    matchId

  let coverUrl =
    media.coverUrl ?? match.previewUrl ?? pickPayloadString(payload, "coverUrl")
  let videoUrl = media.videoUrl ?? pickPayloadString(payload, "videoUrl")

  const basePath = buildScrapedMediaPath(
    ["pending-matches", match.favoriteId, platform, externalId],
    "media"
  )

  if (coverUrl && !isVercelBlobUrl(coverUrl)) {
    const stored = await persistRemoteMediaToBlob({
      remoteUrl: coverUrl,
      blobPath: `${basePath}-cover`,
      kind: "image",
    })
    if (stored) {
      payload.sourceCoverUrl = coverUrl
      coverUrl = stored
    }
  }

  if (videoUrl && !isVercelBlobUrl(videoUrl)) {
    const stored = await persistRemoteMediaToBlob({
      remoteUrl: videoUrl,
      blobPath: `${basePath}-video`,
      kind: "video",
    })
    if (stored) {
      payload.sourceVideoUrl = videoUrl
      videoUrl = stored
    }
  }

  if (coverUrl || videoUrl) {
    payload.mediaStoredAt = new Date().toISOString()
  }

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
