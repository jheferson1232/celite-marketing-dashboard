import { getSociaVaultClient } from "./sociavault-client"
import type { PendingMatchCandidate } from "./search-pending-matches"
import {
  fetchInstagramReelMedia,
  instagramReelUrl,
} from "./instagram-reel-media"
import {
  asRecord,
  pickString,
  valuesFromListOrMap,
} from "./sociavault-parse-utils"

const REEL_URL_RE =
  /instagram\.com\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/i

function parseGoogleResults(data: unknown): Array<Record<string, unknown>> {
  const root = asRecord(data) ?? {}
  const inner = asRecord(root.data) ?? root
  const resultsLayer = asRecord(inner.data) ?? inner
  return valuesFromListOrMap(resultsLayer.results)
    .map((item) => asRecord(item))
    .filter(Boolean) as Array<Record<string, unknown>>
}

function reelShortcodeFromUrl(url: string | null): string | null {
  if (!url) return null
  const match = url.match(REEL_URL_RE)
  return match?.[1] ?? null
}

function applyReelMedia(
  candidate: PendingMatchCandidate,
  media: NonNullable<Awaited<ReturnType<typeof fetchInstagramReelMedia>>>
): PendingMatchCandidate {
  const shortcode = media.shortcode ?? candidate.externalId

  return {
    ...candidate,
    externalId: shortcode,
    title: media.caption?.slice(0, 200) ?? candidate.title,
    pageName: media.pageName ?? candidate.pageName,
    previewUrl: media.coverUrl ?? candidate.previewUrl,
    landingUrl: shortcode ? instagramReelUrl(shortcode) : candidate.landingUrl,
    payload: {
      ...candidate.payload,
      caption: media.caption,
      playCount: media.playCount,
      coverUrl: media.coverUrl,
      videoUrl: media.videoUrl,
      ownerUsername: media.ownerUsername,
    },
  }
}

async function enrichReelFromPostInfo(
  candidate: PendingMatchCandidate
): Promise<PendingMatchCandidate> {
  const url = candidate.landingUrl
  if (!url) return candidate

  const media = await fetchInstagramReelMedia(url, candidate.externalId)
  if (!media) return candidate

  return applyReelMedia(candidate, media)
}

/** Busca reels públicos por keyword vía Google (1 crédito). Opcional: enriquecer con post-info. */
export async function searchInstagramReelsByKeyword(
  query: string,
  options: { enrichPostInfo?: boolean; maxResults?: number; maxEnrich?: number } = {}
): Promise<PendingMatchCandidate[]> {
  const maxResults = options.maxResults ?? 30
  const client = getSociaVaultClient()
  const { data } = await client.get("/v1/scrape/google/search", {
    params: { query: `site:instagram.com/reel ${query}` },
  })

  const rows = parseGoogleResults(data)
  const matches: PendingMatchCandidate[] = []

  for (const row of rows) {
    if (matches.length >= maxResults) break

    const url = pickString(row.url)
    const shortcode = reelShortcodeFromUrl(url)
    if (!url || !shortcode) continue

    const title = pickString(row.title, row.description)
    const description = pickString(row.description)
    const pagemap = asRecord(row.pagemap)
    const cseImage = Array.isArray(pagemap?.cse_image)
      ? asRecord(pagemap.cse_image[0])
      : null
    const metatags = Array.isArray(pagemap?.metatags)
      ? asRecord(pagemap.metatags[0])
      : null
    const googleThumbnail = pickString(
      row.image,
      row.thumbnail,
      cseImage?.src,
      metatags?.["og:image"]
    )

    matches.push({
      matchType: "video",
      platform: "instagram",
      externalId: shortcode,
      title: title ?? description?.slice(0, 120) ?? null,
      pageName: null,
      score: 0.5,
      previewUrl: googleThumbnail,
      landingUrl: instagramReelUrl(shortcode),
      searchQuery: query,
      payload: {
        platform: "instagram",
        searchQuery: query,
        googleTitle: title,
        googleDescription: description,
        googleThumbnail,
        source: "google_reel_search",
      },
    })
  }

  if (!options.enrichPostInfo || matches.length === 0) {
    return matches
  }

  const maxEnrich = Math.min(options.maxEnrich ?? 30, matches.length)
  const head = matches.slice(0, maxEnrich)
  const tail = matches.slice(maxEnrich)
  const batchSize = 5
  const enrichedHead: PendingMatchCandidate[] = []

  for (let i = 0; i < head.length; i += batchSize) {
    const batch = head.slice(i, i + batchSize)
    enrichedHead.push(
      ...(await Promise.all(batch.map((item) => enrichReelFromPostInfo(item))))
    )
  }

  return [...enrichedHead, ...tail]
}
