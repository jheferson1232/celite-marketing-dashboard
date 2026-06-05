import {
  asRecord,
  pickString,
  valuesFromListOrMap,
} from "./sociavault-parse-utils"

export type MetaAdCreativeCandidate = {
  externalId: string
  title: string | null
  pageName: string | null
  previewUrl: string | null
  landingUrl: string | null
  isActive: boolean
  mediaType: string | null
  startDate: string | null
  endDate: string | null
  score: number
  payload: Record<string, unknown>
}

export type MetaCompanySearchResult = {
  pageId: string
  name: string
  logoUrl: string | null
  category: string | null
  likes: number | null
}

function parseBool(value: unknown): boolean {
  if (typeof value === "boolean") return value
  if (value === 1 || value === "1" || value === "true") return true
  return false
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function pickPreviewFromSnapshot(snapshot: Record<string, unknown> | null): {
  previewUrl: string | null
  landingUrl: string | null
  title: string | null
  mediaType: string | null
} {
  if (!snapshot) {
    return {
      previewUrl: null,
      landingUrl: null,
      title: null,
      mediaType: null,
    }
  }

  const cards = valuesFromListOrMap(snapshot.cards)
  const firstCard = asRecord(cards[0])

  const previewUrl = pickString(
    firstCard?.original_image_url,
    firstCard?.resized_image_url,
    firstCard?.video_preview_image_url,
    snapshot.page_profile_picture_url
  )

  const landingUrl = pickString(
    firstCard?.link_url,
    snapshot.link_url,
    snapshot.caption
  )

  const title = pickString(
    snapshot.title,
    firstCard?.title,
    pickString(snapshot.body, asRecord(snapshot.body)?.text)
  )

  const hasVideo = Boolean(
    pickString(
      firstCard?.video_hd_url,
      firstCard?.video_sd_url,
      firstCard?.video_preview_image_url
    )
  )
  const mediaType = hasVideo ? "video" : previewUrl ? "image" : null

  return { previewUrl, landingUrl, title, mediaType }
}

export function parseMetaAdRow(
  row: Record<string, unknown>,
  scoreBoost = 0
): MetaAdCreativeCandidate | null {
  const externalId = pickString(
    row.ad_archive_id,
    row.adArchiveID,
    row.ad_archiveID,
    row.id
  )
  if (!externalId) return null

  const snapshot = asRecord(row.snapshot)
  const media = pickPreviewFromSnapshot(snapshot)

  const title =
    media.title ??
    pickString(row.title, row.ad_creative_bodies, row.ad_creative_link_titles)

  const pageName = pickString(row.page_name, snapshot?.page_name)
  const landingUrl =
    media.landingUrl ??
    pickString(row.link_url, row.landing_page_url, row.display_url)

  const previewUrl =
    media.previewUrl ??
    pickString(
      row.thumbnail_url,
      row.image_url,
      snapshot?.page_profile_picture_url
    )

  return {
    externalId,
    title,
    pageName,
    previewUrl,
    landingUrl,
    isActive: parseBool(row.is_active ?? row.isActive),
    mediaType: media.mediaType,
    startDate: pickString(row.start_date_string, row.startDateString),
    endDate: pickString(row.end_date_string, row.endDateString),
    score: Math.min(1, 0.5 + scoreBoost),
    payload: row,
  }
}

export function parseMetaAdResults(
  data: unknown,
  options?: { domain?: string | null; maxResults?: number }
): {
  results: MetaAdCreativeCandidate[]
  totalAds: number | null
  activeAds: number | null
} {
  const root = asRecord(data) ?? {}
  const inner = asRecord(root.data) ?? root

  const rawResults = valuesFromListOrMap(
    inner.results ?? inner.searchResults ?? inner.ads
  )

  const domain = options?.domain?.toLowerCase().replace(/^www\./, "") ?? null
  const maxResults = options?.maxResults ?? 50

  const parsed: MetaAdCreativeCandidate[] = []
  for (const item of rawResults) {
    const row = asRecord(item)
    if (!row) continue

    const candidate = parseMetaAdRow(row, domain ? 0.1 : 0)
    if (!candidate) continue

    if (domain) {
      const haystack = [
        candidate.landingUrl,
        candidate.title,
        candidate.pageName,
        JSON.stringify(candidate.payload),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      if (!haystack.includes(domain)) {
        candidate.score = Math.max(0.1, candidate.score - 0.25)
      } else {
        candidate.score = Math.min(1, candidate.score + 0.2)
      }
    }

    parsed.push(candidate)
    if (parsed.length >= maxResults) break
  }

  const totalAds =
    parseNumber(inner.searchResultsCount) ??
    parseNumber(inner.total_count) ??
    parseNumber(inner.totalCount)

  const activeAds = parsed.filter((item) => item.isActive).length

  return {
    results: parsed.sort((a, b) => b.score - a.score),
    totalAds,
    activeAds: totalAds != null ? activeAds : null,
  }
}

export function parseMetaCompanySearchResults(
  data: unknown
): MetaCompanySearchResult[] {
  const root = asRecord(data) ?? {}
  const inner = asRecord(root.data) ?? root
  const rows = valuesFromListOrMap(inner.searchResults ?? inner.results)

  const companies: MetaCompanySearchResult[] = []
  for (const item of rows) {
    const row = asRecord(item)
    if (!row) continue
    const pageId = pickString(row.page_id, row.pageId)
    const name = pickString(row.name, row.page_name)
    if (!pageId || !name) continue

    companies.push({
      pageId,
      name,
      logoUrl: pickString(row.image_uri, row.profile_picture_url),
      category: pickString(row.category),
      likes: parseNumber(row.likes),
    })
  }

  return companies
}

export function mergeMetaAdCandidates(
  lists: MetaAdCreativeCandidate[][]
): MetaAdCreativeCandidate[] {
  const byId = new Map<string, MetaAdCreativeCandidate>()

  for (const list of lists) {
    for (const item of list) {
      const existing = byId.get(item.externalId)
      if (!existing || item.score > existing.score) {
        byId.set(item.externalId, item)
      }
    }
  }

  return [...byId.values()].sort((a, b) => b.score - a.score)
}

export function normalizeStoreDomain(
  input: string | null | undefined
): string | null {
  const raw = input?.trim()
  if (!raw) return null

  try {
    const url = raw.includes("://") ? raw : `https://${raw}`
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase()
  } catch {
    return raw
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      ?.toLowerCase() ?? null
  }
}
