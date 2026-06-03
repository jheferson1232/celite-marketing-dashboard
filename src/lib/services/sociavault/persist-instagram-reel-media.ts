import {
  buildScrapedMediaPath,
  persistRemoteMediaToBlob,
} from "@/lib/services/blob/persist-remote-media"
import type { InstagramReelMedia } from "./instagram-reel-media"

export async function persistInstagramReelMedia(
  media: InstagramReelMedia
): Promise<InstagramReelMedia> {
  const key = media.shortcode?.trim() || "unknown"
  const basePath = buildScrapedMediaPath(
    ["instagram-reels", key],
    "media"
  )

  const [storedCover, storedVideo] = await Promise.all([
    media.coverUrl
      ? persistRemoteMediaToBlob({
          remoteUrl: media.coverUrl,
          blobPath: `${basePath}-cover`,
          kind: "image",
        })
      : Promise.resolve(null),
    media.videoUrl
      ? persistRemoteMediaToBlob({
          remoteUrl: media.videoUrl,
          blobPath: `${basePath}-video`,
          kind: "video",
        })
      : Promise.resolve(null),
  ])

  if (!storedCover && !storedVideo) return media

  return {
    ...media,
    coverUrl: storedCover ?? media.coverUrl,
    videoUrl: storedVideo ?? media.videoUrl,
  }
}
