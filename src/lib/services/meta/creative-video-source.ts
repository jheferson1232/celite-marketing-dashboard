import axios from "axios"
import { getMetaClient } from "./meta"
import { withMetaCache } from "./meta-cache"

interface MetaAdVideo {
  id: string
  source?: string
}

interface MetaAdVideosResponse {
  data: MetaAdVideo[]
  paging?: { next?: string }
}

const VIDEO_SOURCE_TTL_MS = 30 * 60 * 1000
const ALL_VIDEOS_CACHE_KEY = "all-advideos-sources"

export async function getAllAdVideoSourcesMap(): Promise<Map<string, string>> {
  const cached = await withMetaCache(
    ALL_VIDEOS_CACHE_KEY,
    VIDEO_SOURCE_TTL_MS,
    fetchAllAdVideoSourcesMap
  )
  return new Map(cached as Map<string, string>)
}

async function fetchAllAdVideoSourcesMap(): Promise<Map<string, string>> {
  const api = getMetaClient()
  const sourceMap = new Map<string, string>()

  let nextUrl: string | undefined
  let page = 0

  do {
    const response: { data: MetaAdVideosResponse } = nextUrl
      ? await axios.get<MetaAdVideosResponse>(nextUrl)
      : await api.get<MetaAdVideosResponse>("/advideos", {
          params: {
            fields: "id,source",
            limit: 100,
          },
        })

    for (const video of response.data.data ?? []) {
      if (video.id && video.source) {
        sourceMap.set(String(video.id), video.source)
      }
    }

    nextUrl = response.data.paging?.next
    page++

    if (nextUrl && page < 50) {
      await new Promise((resolve) => setTimeout(resolve, 200))
    } else {
      nextUrl = undefined
    }
  } while (nextUrl)

  return sourceMap
}

export async function fetchVideoSourcesByIds(
  videoIds: string[]
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(videoIds.filter(Boolean))]
  const sourceMap = new Map<string, string>()

  if (uniqueIds.length === 0) {
    return sourceMap
  }

  const allVideos = await getAllAdVideoSourcesMap()

  for (const videoId of uniqueIds) {
    const source = allVideos.get(String(videoId))
    if (source) {
      sourceMap.set(String(videoId), source)
    }
  }

  return sourceMap
}

export async function getCreativeVideoSource(
  videoId: string
): Promise<string | null> {
  const cacheKey = `video-source:${videoId}`
  const cached = await withMetaCache(cacheKey, VIDEO_SOURCE_TTL_MS, async () => {
    const allVideos = await getAllAdVideoSourcesMap()
    return allVideos.get(String(videoId)) ?? null
  })

  return cached ?? null
}
