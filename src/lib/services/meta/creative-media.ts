import { getMetaClient } from "./meta"
import type { MetaAdCreative } from "./types"

interface MetaAdImage {
  hash: string
  url?: string
  url_128?: string
}

interface MetaAdImagesResponse {
  data: MetaAdImage[]
}

export function extractCreativeMediaUrls(creative: MetaAdCreative): {
  thumbnailUrl: string
  imageUrl?: string
} {
  const spec = creative.object_story_spec
  const fromSpec =
    spec?.photo_data?.url ||
    spec?.link_data?.picture ||
    spec?.link_data?.image_url ||
    spec?.video_data?.image_url

  const thumbnailUrl =
    creative.thumbnail_url || fromSpec || creative.image_url || ""

  const imageUrl = fromSpec || creative.image_url

  return { thumbnailUrl, imageUrl }
}

export async function fetchAdImageUrlsByHash(
  hashes: string[]
): Promise<Map<string, string>> {
  const uniqueHashes = [...new Set(hashes.filter(Boolean))]
  const urlMap = new Map<string, string>()

  if (uniqueHashes.length === 0) {
    return urlMap
  }

  const api = getMetaClient()
  const BATCH_SIZE = 50

  for (let i = 0; i < uniqueHashes.length; i += BATCH_SIZE) {
    const chunk = uniqueHashes.slice(i, i + BATCH_SIZE)

    try {
      const response = await api.get<MetaAdImagesResponse>("/adimages", {
        params: {
          hashes: JSON.stringify(chunk),
          fields: "hash,url,url_128",
        },
      })

      for (const image of response.data.data ?? []) {
        const url = image.url || image.url_128
        if (url) {
          urlMap.set(image.hash, url)
        }
      }
    } catch (error) {
      console.error("Error fetching ad images batch:", error)
    }
  }

  return urlMap
}

interface MetaAdVideo {
  id: string
  picture?: string
}

interface MetaAdVideosResponse {
  data: MetaAdVideo[]
}

export async function fetchAdVideoPicturesById(
  videoIds: string[]
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(videoIds.filter(Boolean))]
  const pictureMap = new Map<string, string>()

  if (uniqueIds.length === 0) {
    return pictureMap
  }

  const api = getMetaClient()
  const BATCH_SIZE = 50

  for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
    const chunk = uniqueIds.slice(i, i + BATCH_SIZE)

    try {
      const response = await api.get<MetaAdVideosResponse>("/advideos", {
        params: {
          video_ids: JSON.stringify(chunk),
          fields: "id,picture",
        },
      })

      for (const video of response.data.data ?? []) {
        if (video.picture) {
          pictureMap.set(video.id, video.picture)
        }
      }
    } catch (error) {
      console.error("Error fetching ad video pictures batch:", error)
    }
  }

  return pictureMap
}

export function resolveCreativeMediaUrls(
  creative: MetaAdCreative,
  imageHashMap: Map<string, string>,
  videoPictureMap?: Map<string, string>
): { thumbnailUrl: string; imageUrl?: string } {
  const { thumbnailUrl, imageUrl } = extractCreativeMediaUrls(creative)
  const hashUrl = creative.image_hash
    ? imageHashMap.get(creative.image_hash)
    : undefined

  if (hashUrl) {
    const display = pickDisplayImageUrl(undefined, hashUrl)
    return {
      thumbnailUrl: display,
      imageUrl: display,
    }
  }

  const videoPictureUrl = creative.video_id
    ? videoPictureMap?.get(creative.video_id)
    : undefined

  if (videoPictureUrl) {
    const display = pickDisplayImageUrl(videoPictureUrl, imageUrl || videoPictureUrl)
    return {
      thumbnailUrl: display,
      imageUrl: display,
    }
  }

  const display = pickDisplayImageUrl(thumbnailUrl, imageUrl || thumbnailUrl || undefined)
  return {
    thumbnailUrl: display,
    imageUrl: imageUrl ? pickDisplayImageUrl(thumbnailUrl, imageUrl) : display,
  }
}

/** Prefer high-res URL for display; upscale Meta CDN size tokens when present. */
export function pickDisplayImageUrl(
  thumbnailUrl?: string,
  imageUrl?: string
): string {
  const best = imageUrl || thumbnailUrl || ""
  return upscaleMetaCdnUrl(best)
}

/**
 * Meta often serves tiny thumbs (p64x64, s130x130). Bump known size tokens
 * so cards render sharper on retina displays.
 */
export function upscaleMetaCdnUrl(url: string): string {
  if (!url) return url

  return url
    .replace(/\bp(\d+)x(\d+)\b/gi, (_, w, h) => {
      const width = Number(w)
      const height = Number(h)
      if (width >= 480 || height >= 480) return `p${w}x${h}`
      return "p720x720"
    })
    .replace(/\bs(\d+)x(\d+)\b/gi, (_, w, h) => {
      const width = Number(w)
      const height = Number(h)
      if (width >= 480 || height >= 480) return `s${w}x${h}`
      return "s720x720"
    })
    .replace(/([?&])width=\d+/gi, "$1width=720")
    .replace(/([?&])height=\d+/gi, "$1height=1280")
}
