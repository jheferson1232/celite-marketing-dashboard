import axios from "axios"
import { extractVideoIdFromCreative } from "./extract-video-id"
import { getCreativeVideoSource } from "./creative-video-source"
import { withMetaCache } from "./meta-cache"

interface MetaAdCreativeResponse {
  id?: string
  creative?: {
    id?: string
    video_id?: string
    object_story_spec?: {
      video_data?: { video_id?: string }
    }
    asset_feed_spec?: {
      videos?: Array<{ video_id?: string }>
    }
  }
}

interface MetaAdPreviewResponse {
  data?: Array<{ body?: string }>
}

const AD_VIDEO_TTL_MS = 30 * 60 * 1000

function extractIframeSrc(html: string): string | null {
  const match = html.match(/src="([^"]+)"/)
  if (!match?.[1]) return null
  return match[1].replace(/&amp;/g, "&")
}

export async function getAdPreviewEmbedUrl(adId: string): Promise<string | null> {
  const token = process.env.META_ACCESS_TOKEN
  if (!token) return null

  const { data } = await axios.get<MetaAdPreviewResponse>(
    `https://graph.facebook.com/v25.0/${adId}/previews`,
    {
      params: {
        ad_format: "MOBILE_FEED_STANDARD",
        access_token: token,
      },
    }
  )

  const body = data.data?.[0]?.body
  return body ? extractIframeSrc(body) : null
}

export async function getAdVideoSource(adId: string): Promise<{
  sourceUrl: string | null
  embedUrl: string | null
}> {
  return withMetaCache(`ad-video-source:${adId}`, AD_VIDEO_TTL_MS, async () => {
    const token = process.env.META_ACCESS_TOKEN
    if (!token) {
      return { sourceUrl: null, embedUrl: null }
    }

    const { data } = await axios.get<MetaAdCreativeResponse>(
      `https://graph.facebook.com/v25.0/${adId}`,
      {
        params: {
          fields:
            "creative{id,video_id,object_story_spec{video_data{video_id}},asset_feed_spec{videos{video_id}}}",
          access_token: token,
        },
      }
    )

    const videoId = extractVideoIdFromCreative(data.creative)
    let sourceUrl: string | null = null

    if (videoId) {
      sourceUrl = await getCreativeVideoSource(videoId)
    }

    const embedUrl = sourceUrl ? null : await getAdPreviewEmbedUrl(adId)

    return { sourceUrl, embedUrl }
  })
}
