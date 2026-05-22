import { extractCreativeDestinationUrl } from "./creative-url"
import { metaGraphGet } from "./meta-graph-retry"

const CREATIVE_BATCH_FIELDS =
  "id,creative{link_url,object_url," +
  "object_story_spec{link_data{link,call_to_action{value{link}}}," +
  "video_data{call_to_action{value{link}}},template_data{link}}," +
  "asset_feed_spec{link_urls{website_url}}}"

const BATCH_SIZE = 15
const BATCH_DELAY_MS = 900

/** URLs únicas desde IDs de anuncio (batch Graph API, con reintentos). */
export async function fetchUniqueLandingUrlsFromAdIds(
  adIds: string[]
): Promise<string[]> {
  const token = process.env.META_ACCESS_TOKEN
  if (!token || adIds.length === 0) return []

  const urlMap = new Map<string, string>()
  const uniqueIds = [...new Set(adIds.filter(Boolean))]

  for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
    const chunk = uniqueIds.slice(i, i + BATCH_SIZE)
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS))
    }

    const data = await metaGraphGet<Record<string, { creative?: unknown }>>(
      "https://graph.facebook.com/v25.0/",
      {
        params: {
          ids: chunk.join(","),
          fields: CREATIVE_BATCH_FIELDS,
          access_token: token,
        },
      }
    )

    for (const ad of Object.values(data)) {
      const url = extractCreativeDestinationUrl(
        ad.creative as Parameters<typeof extractCreativeDestinationUrl>[0]
      )
      if (!url) continue
      if (!urlMap.has(url)) urlMap.set(url, url)
    }

  }

  return [...urlMap.values()].sort((a, b) => a.localeCompare(b))
}
