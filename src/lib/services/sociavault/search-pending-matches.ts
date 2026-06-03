import axios from "axios"
import { getSociaVaultClient } from "./sociavault-client"
import {
  extractTikTokCoverUrl,
  extractTikTokVideoUrl,
} from "./tiktok-media-urls"
import { filterRelevantMatches } from "./match-relevance-filter"
import { resolveSociaVaultSearchQueries } from "./resolve-search-queries"
import { getSociaVaultSearchConfig } from "./sociavault-config"
import { asRecord, pickString } from "./sociavault-parse-utils"

export type PendingMatchCandidate = {
  matchType: "campaign" | "video"
  platform: "instagram" | "tiktok"
  externalId: string | null
  title: string | null
  pageName: string | null
  score: number
  previewUrl: string | null
  landingUrl: string | null
  searchQuery: string
  payload: Record<string, unknown>
}

export type SociaVaultProductSearchInput = {
  name: string
  imageUrls?: string[]
  /** Tokens de exclusión (ids/urls) para no repetir videos ya mostrados. */
  excludeMatchKeys?: string[]
  /** Orden TikTok distinto en re-búsquedas (p. ej. most-liked). */
  tiktokSortBy?: string
  /** Cuántos ítems parsear antes de filtrar/excluir. */
  tiktokParseLimit?: number
}

export type SociaVaultSearchOutcome = {
  matches: PendingMatchCandidate[]
  warnings: string[]
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .split(/[^a-z0-9áéíóúñ]+/i)
      .map((t) => t.trim())
      .filter((t) => t.length > 2)
  )
}

function scoreText(
  query: string,
  ...parts: Array<string | null | undefined>
): number {
  const queryTokens = tokenize(query)
  if (queryTokens.size === 0) return 0

  const haystack = tokenize(parts.filter(Boolean).join(" "))
  if (haystack.size === 0) return 0

  let hits = 0
  for (const token of queryTokens) {
    if (haystack.has(token)) hits++
  }

  return hits / queryTokens.size
}

function mergeMatches(candidates: PendingMatchCandidate[]): PendingMatchCandidate[] {
  const byKey = new Map<string, PendingMatchCandidate>()

  for (const match of candidates) {
    const key = `${match.platform}:${match.externalId ?? match.landingUrl ?? match.title ?? ""}`
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, match)
      continue
    }
    existing.score = Math.min(1, Math.max(existing.score, match.score) + 0.05)
    if (!existing.previewUrl && match.previewUrl) {
      existing.previewUrl = match.previewUrl
    }
    if (!existing.landingUrl && match.landingUrl) {
      existing.landingUrl = match.landingUrl
    }
  }

  return [...byKey.values()]
    .map((match) => {
      if (match.externalId && match.score < 0.2) {
        return { ...match, score: 0.25 }
      }
      return match
    })
    .filter((m) => m.score >= 0.15)
    .sort((a, b) => b.score - a.score)
}

function capTikTokMatches(
  matches: PendingMatchCandidate[],
  maxResults: number
): PendingMatchCandidate[] {
  return matches
    .filter((m) => m.platform === "tiktok")
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
}

function logSociaVaultError(platform: string, query: string, error: unknown) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const data = error.response?.data as { error?: string } | undefined
    const message = data?.error ?? error.message
    console.error(
      `SociaVault ${platform} (${query.slice(0, 60)}): HTTP ${status ?? "?"} — ${message}`
    )
    return
  }
  console.error(`SociaVault ${platform} (${query.slice(0, 60)}):`, error)
}

function sociavaultErrorMessage(error: unknown): string | null {
  if (!axios.isAxiosError(error)) return null
  const data = error.response?.data as
    | { error?: string; available?: number }
    | undefined
  if (data?.error) {
    if (typeof data.available === "number") {
      return `${data.error} (disponibles: ${data.available})`
    }
    return data.error
  }
  return error.message
}

function parseTikTokSearchItems(inner: Record<string, unknown>): unknown[] {
  const list = inner.search_item_list
  if (Array.isArray(list)) return list
  if (list && typeof list === "object") {
    return Object.values(list as Record<string, unknown>)
  }
  const legacy = inner.videos ?? inner.searchResults ?? inner.items
  return Array.isArray(legacy) ? legacy : []
}

async function searchTikTokVideos(
  query: string,
  region: string | undefined,
  maxResults: number,
  options?: { sortBy?: string; parseLimit?: number }
): Promise<PendingMatchCandidate[]> {
  const client = getSociaVaultClient()
  const sortBy = options?.sortBy?.trim() || "relevance"
  const { data } = await client.get("/v1/scrape/tiktok/search/keyword", {
    params: {
      query,
      sort_by: sortBy,
      date_posted: "all-time",
      ...(region ? { region } : {}),
    },
  })

  const root = asRecord(data) ?? {}
  const inner = asRecord(root.data) ?? root
  const items = parseTikTokSearchItems(inner)
  if (items.length === 0) return []

  const matches: PendingMatchCandidate[] = []

  const parseLimit = Math.min(
    50,
    Math.max(
      maxResults,
      maxResults * 2,
      options?.parseLimit ?? 0
    )
  )
  for (const item of items.slice(0, parseLimit)) {
    const row = asRecord(item)
    if (!row) continue

    const aweme = asRecord(row.aweme_info) ?? row
    const author = asRecord(aweme.author) ?? asRecord(aweme.authorMeta)
    const video = asRecord(aweme.video)
    const statistics = asRecord(aweme.statistics)

    const title = pickString(aweme.desc, aweme.description, aweme.title)
    const pageName = pickString(author?.nickname, author?.unique_id)
    const externalId = pickString(aweme.aweme_id, aweme.id, aweme.video_id)
    const score = scoreText(query, title, pageName)

    const shareUrl = pickString(aweme.share_url, aweme.url)
    const authorHandle = pickString(author?.unique_id)
    const landingUrl =
      shareUrl ??
      (externalId && authorHandle
        ? `https://www.tiktok.com/@${authorHandle}/video/${externalId}`
        : null)

    const coverUrl =
      extractTikTokCoverUrl(video) ??
      pickString(aweme.cover, aweme.cover_url, aweme.dynamic_cover)
    const videoUrl = extractTikTokVideoUrl(video)

    matches.push({
      matchType: "video",
      platform: "tiktok",
      externalId,
      title,
      pageName,
      score,
      previewUrl: coverUrl,
      landingUrl,
      searchQuery: query,
      payload: {
        ...aweme,
        statistics,
        platform: "tiktok",
        searchQuery: query,
        coverUrl,
        videoUrl,
        authorHandle,
      },
    })
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, maxResults)
}

export async function searchSociaVaultMatchesForProduct(
  input: SociaVaultProductSearchInput | string
): Promise<PendingMatchCandidate[]> {
  const outcome = await searchSociaVaultMatchesWithOutcome(input)
  return outcome.matches
}

export async function searchSociaVaultMatchesWithOutcome(
  input: SociaVaultProductSearchInput | string
): Promise<SociaVaultSearchOutcome> {
  const product =
    typeof input === "string"
      ? { name: input, imageUrls: [] as string[] }
      : input

  const name = product.name.trim()
  const warnings: string[] = []

  if (!name && (product.imageUrls?.length ?? 0) === 0) {
    return { matches: [], warnings }
  }

  const config = getSociaVaultSearchConfig()
  const excludeKeys = new Set(
    (product.excludeMatchKeys ?? []).map((key) => key.trim()).filter(Boolean)
  )
  const { queries, imageKeywords } = await resolveSociaVaultSearchQueries({
    name,
    imageUrls: product.imageUrls,
  })
  if (queries.length === 0) return { matches: [], warnings }

  const tiktokSortBy = product.tiktokSortBy?.trim() || "relevance"
  const tiktokParseLimit =
    product.tiktokParseLimit ??
    (excludeKeys.size > 0 ? config.maxMatchesPerPlatform * 4 : undefined)

  const country =
    process.env.SOCIAVAULT_AD_LIBRARY_COUNTRY?.trim() || "ALL"
  const tiktokRegion =
    process.env.SOCIAVAULT_TIKTOK_REGION?.trim() ||
    (country.length === 2 ? country : undefined)

  const all: PendingMatchCandidate[] = []

  for (const query of queries) {
    if (config.searchTikTok) {
      try {
        const tiktokMatches = await searchTikTokVideos(
          query,
          tiktokRegion,
          config.maxMatchesPerPlatform,
          {
            sortBy: tiktokSortBy,
            parseLimit: tiktokParseLimit,
          }
        )
        all.push(...tiktokMatches)
      } catch (error) {
        const message = sociavaultErrorMessage(error)
        warnings.push(
          message ? `TikTok: ${message}` : "TikTok no respondió en esta búsqueda."
        )
        logSociaVaultError("TikTok", query, error)
      }
    }
  }

  const merged = mergeMatches(all)
  const withoutExcluded =
    excludeKeys.size > 0
      ? merged.filter((match) => {
          const key = `${match.platform}:${match.externalId ?? match.landingUrl ?? match.title ?? ""}`
          if (excludeKeys.has(key)) return false
          if (match.externalId) {
            if (excludeKeys.has(`id:${match.externalId.toLowerCase()}`)) return false
            if (excludeKeys.has(`${match.platform}:id:${match.externalId.toLowerCase()}`)) {
              return false
            }
          }
          if (match.landingUrl && excludeKeys.has(`url:${match.landingUrl.toLowerCase()}`)) {
            return false
          }
          const videoUrl =
            typeof match.payload.videoUrl === "string" ? match.payload.videoUrl : null
          if (videoUrl && excludeKeys.has(`video:${videoUrl.toLowerCase()}`)) {
            return false
          }
          return true
        })
      : merged

  const filtered = filterRelevantMatches(withoutExcluded, name, imageKeywords)
  const matches = capTikTokMatches(filtered, config.maxMatchesPerPlatform)

  if (config.searchTikTok && matches.length === 0 && !warnings.some((w) => /TikTok/i.test(w))) {
    warnings.push("Sin videos de TikTok para esta consulta.")
  }

  return { matches, warnings }
}
