export type MatchForRelevanceFilter = {
  title: string | null
  pageName: string | null
  searchQuery: string
  score: number
  payload: Record<string, unknown>
}

const DEFAULT_EXCLUDE_PHRASES = [
  "purificador de aire",
  "purificadores de aire",
  "air purifier",
  "air purifiers",
  "ionizador de aire",
]

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
}

function meaningfulTokens(text: string): string[] {
  const stop = new Set([
    "de",
    "la",
    "el",
    "los",
    "las",
    "un",
    "una",
    "y",
    "en",
    "para",
    "con",
    "del",
    "al",
    "por",
    "the",
    "and",
    "for",
  ])
  return normalizeText(text)
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !stop.has(t))
}

export function getExcludePhrasesForProduct(productName: string): string[] {
  const fromEnv = process.env.SOCIAVAULT_EXCLUDE_PHRASES?.split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 1)

  const phrases = fromEnv?.length ? fromEnv : DEFAULT_EXCLUDE_PHRASES
  const nameNorm = normalizeText(productName)

  return phrases.filter((phrase) => {
    const p = normalizeText(phrase)
    if (p.includes("purificador") && nameNorm.includes("purificador")) {
      return false
    }
    if (p.includes("aire") && nameNorm.includes("purificador")) {
      return false
    }
    return true
  })
}

export function textHasExcludedTopic(
  text: string,
  excludePhrases: string[]
): boolean {
  const norm = normalizeText(text)

  for (const phrase of excludePhrases) {
    if (norm.includes(normalizeText(phrase))) return true
  }

  if (
    norm.includes("purificador") &&
    (/\baire\b/.test(norm) || norm.includes("air purif"))
  ) {
    return true
  }

  if (norm.includes("#purificadordeaire") || norm.includes("purificadordeaire")) {
    return true
  }

  return false
}

function matchTextBlob(match: MatchForRelevanceFilter): string {
  const desc =
    typeof match.payload.desc === "string"
      ? match.payload.desc
      : typeof match.payload.description === "string"
        ? match.payload.description
        : ""

  return [match.title, match.pageName, match.searchQuery, desc]
    .filter(Boolean)
    .join(" ")
}

function productRelevanceScore(
  match: MatchForRelevanceFilter,
  productName: string,
  imageKeywords: string[]
): number {
  const productTokens = meaningfulTokens(
    [productName, ...imageKeywords].join(" ")
  )
  if (productTokens.length === 0) return match.score

  const haystack = normalizeText(matchTextBlob(match))
  let hits = 0
  for (const token of productTokens) {
    if (haystack.includes(token)) hits++
  }

  return hits / productTokens.length
}

function isInstagramReelMatch(match: MatchForRelevanceFilter): boolean {
  return match.payload.platform === "instagram"
}

export function filterRelevantMatches<T extends MatchForRelevanceFilter>(
  candidates: T[],
  productName: string,
  imageKeywords: string[] = [],
  minProductRelevanceOverride?: number
): T[] {
  const excludePhrases = getExcludePhrasesForProduct(productName)
  const minProductRelevance =
    minProductRelevanceOverride ??
    (Number(process.env.SOCIAVAULT_MIN_PRODUCT_RELEVANCE) || 0.2)

  return candidates
    .filter((match) => {
      const blob = matchTextBlob(match)
      if (textHasExcludedTopic(blob, excludePhrases)) return false

      // Instagram: la búsqueda ya va por keyword en Google; no exigir tokens del catálogo.
      if (isInstagramReelMatch(match)) return true

      const relevance = productRelevanceScore(
        match,
        productName,
        imageKeywords
      )
      return relevance >= minProductRelevance
    })
    .map((match) => ({
      ...match,
      score: Math.min(
        1,
        Math.max(
          match.score,
          productRelevanceScore(match, productName, imageKeywords)
        )
      ),
    }))
}

export function filterSearchQueries(
  queries: string[],
  productName: string
): string[] {
  const excludePhrases = getExcludePhrasesForProduct(productName)
  return queries.filter((q) => !textHasExcludedTopic(q, excludePhrases))
}

export function filterImageKeywords(
  keywords: string[],
  productName: string
): string[] {
  const excludePhrases = getExcludePhrasesForProduct(productName)
  return keywords.filter((k) => !textHasExcludedTopic(k, excludePhrases))
}

/** Filtra coincidencias ya guardadas en BD (misma lógica que al buscar). */
export function shouldHideStoredMatch(
  match: {
    title: string | null
    pageName: string | null
    payload: Record<string, unknown>
  },
  productName: string
): boolean {
  const excludePhrases = getExcludePhrasesForProduct(productName)
  const searchQuery =
    typeof match.payload.searchQuery === "string"
      ? match.payload.searchQuery
      : ""
  const desc =
    typeof match.payload.desc === "string"
      ? match.payload.desc
      : typeof match.payload.description === "string"
        ? match.payload.description
        : ""

  const blob = [match.title, match.pageName, searchQuery, desc]
    .filter(Boolean)
    .join(" ")

  if (textHasExcludedTopic(blob, excludePhrases)) return true

  if (match.payload.platform === "instagram") return false

  const productTokens = meaningfulTokens(productName)
  if (productTokens.length === 0) return false

  const haystack = normalizeText(blob)
  const hits = productTokens.filter((t) => haystack.includes(t)).length
  const minProductRelevance =
    Number(process.env.SOCIAVAULT_MIN_PRODUCT_RELEVANCE) || 0.2

  return hits / productTokens.length < minProductRelevance
}
