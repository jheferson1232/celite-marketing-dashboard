const STOP_WORDS = new Set([
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

function meaningfulTokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^a-z0-9áéíóúñ]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t))
}

export function buildSociaVaultSearchQueries(
  productName: string,
  imageKeywords: string[] = [],
  maxQueries = 6
): string[] {
  const seen = new Set<string>()
  const queries: string[] = []

  const add = (raw: string | null | undefined) => {
    const q = raw?.trim()
    if (!q || q.length < 2) return
    const key = q.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    queries.push(q)
  }

  const name = productName.trim()

  if (maxQueries <= 1) {
    const primary = imageKeywords[0]?.trim() || name
    if (primary) add(primary)
    return queries
  }

  add(name)

  const tokens = meaningfulTokens(name)
  if (tokens.length >= 2) {
    add(tokens.slice(0, 5).join(" "))
    add(tokens.slice(0, 3).join(" "))
  }
  if (tokens.length >= 1) {
    add(tokens[0])
  }

  for (const keyword of imageKeywords) {
    add(keyword)
    const kwTokens = meaningfulTokens(keyword)
    if (kwTokens.length >= 2) {
      add(kwTokens.slice(0, 4).join(" "))
    }
  }

  return queries.slice(0, maxQueries)
}
