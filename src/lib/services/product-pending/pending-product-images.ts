export function parsePendingImageUrls(
  imageUrlsJson: unknown,
  legacyImageUrl: string | null
): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  const add = (url: string | null | undefined) => {
    const trimmed = url?.trim()
    if (!trimmed || seen.has(trimmed)) return
    seen.add(trimmed)
    result.push(trimmed)
  }

  if (Array.isArray(imageUrlsJson)) {
    for (const entry of imageUrlsJson) {
      if (typeof entry === "string") add(entry)
    }
  }

  add(legacyImageUrl)

  return result
}

export function primaryPendingImageUrl(urls: string[]): string | null {
  return urls[0] ?? null
}

export function toPendingImageUrlsJson(urls: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const url of urls) {
    const trimmed = url.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    result.push(trimmed)
  }
  return result
}
