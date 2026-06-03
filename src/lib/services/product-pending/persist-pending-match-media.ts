import type { PendingMatchCandidate } from "@/lib/services/sociavault/search-pending-matches"
import {
  buildScrapedMediaPath,
  mapWithConcurrency,
  persistRemoteMediaToBlob,
} from "@/lib/services/blob/persist-remote-media"
import { pickString } from "@/lib/services/sociavault/sociavault-parse-utils"

const PERSIST_CONCURRENCY = 3

function matchStorageKey(match: PendingMatchCandidate, index: number): string {
  const id =
    match.externalId?.trim() ||
    `${match.platform}-${index}-${(match.title ?? "item").slice(0, 40)}`
  return id.slice(0, 80)
}

export async function persistPendingMatchCandidateMedia(
  productId: string,
  match: PendingMatchCandidate,
  index: number
): Promise<PendingMatchCandidate> {
  const payload = match.payload as Record<string, unknown>
  const sourceCover =
    match.previewUrl ??
    pickString(payload.coverUrl) ??
    pickString(payload.googleThumbnail)
  const sourceVideo = pickString(payload.videoUrl)
  const key = matchStorageKey(match, index)
  const basePath = buildScrapedMediaPath(
    ["pending-matches", productId, match.platform, key],
    "media"
  )

  const [storedCover, storedVideo] = await Promise.all([
    sourceCover
      ? persistRemoteMediaToBlob({
          remoteUrl: sourceCover,
          blobPath: `${basePath}-cover`,
          kind: "image",
        })
      : Promise.resolve(null),
    sourceVideo
      ? persistRemoteMediaToBlob({
          remoteUrl: sourceVideo,
          blobPath: `${basePath}-video`,
          kind: "video",
        })
      : Promise.resolve(null),
  ])

  const storedAt = new Date().toISOString()
  const nextPayload: Record<string, unknown> = {
    ...payload,
    mediaStoredAt: storedAt,
  }

  if (sourceCover) {
    nextPayload.sourceCoverUrl = sourceCover
    if (storedCover) {
      nextPayload.coverUrl = storedCover
    }
  }
  if (sourceVideo) {
    nextPayload.sourceVideoUrl = sourceVideo
    if (storedVideo) {
      nextPayload.videoUrl = storedVideo
    }
  }

  if (!storedCover && !storedVideo && !sourceCover && !sourceVideo) {
    return match
  }

  return {
    ...match,
    previewUrl: storedCover ?? match.previewUrl ?? sourceCover ?? null,
    payload: nextPayload,
  }
}

export async function persistPendingMatchCandidatesMedia(
  productId: string,
  candidates: PendingMatchCandidate[]
): Promise<PendingMatchCandidate[]> {
  if (candidates.length === 0) return candidates

  return mapWithConcurrency(
    candidates,
    (match, index) => persistPendingMatchCandidateMedia(productId, match, index),
    PERSIST_CONCURRENCY
  )
}

export function collectBlobUrlsFromMatchPayload(payload: unknown): string[] {
  const record =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null
  if (!record) return []

  const keys = ["coverUrl", "videoUrl", "sourceCoverUrl", "sourceVideoUrl"] as const
  const urls: string[] = []
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) urls.push(value.trim())
  }
  return urls
}
