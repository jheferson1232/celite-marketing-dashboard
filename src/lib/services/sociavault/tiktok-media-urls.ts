function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/** TikTok devuelve url_list como array o como objeto { "0": url, "1": url }. */
export function pickTikTokUrlList(value: unknown): string | null {
  const record = asRecord(value)
  if (!record) return null

  const list = record.url_list
  if (Array.isArray(list)) {
    for (const entry of list) {
      if (typeof entry === "string" && entry.trim()) return entry.trim()
    }
    return null
  }

  if (list && typeof list === "object") {
    const obj = list as Record<string, unknown>
    const preferred = obj["0"] ?? obj[0]
    if (typeof preferred === "string" && preferred.trim()) {
      return preferred.trim()
    }
    for (const entry of Object.values(obj)) {
      if (typeof entry === "string" && entry.trim()) return entry.trim()
    }
  }

  return null
}

export function extractTikTokCoverUrl(video: Record<string, unknown> | null): string | null {
  if (!video) return null
  return (
    pickTikTokUrlList(video.cover) ??
    pickTikTokUrlList(video.dynamic_cover) ??
    pickTikTokUrlList(video.origin_cover) ??
    pickTikTokUrlList(video.ai_dynamic_cover)
  )
}

export function extractTikTokVideoUrl(video: Record<string, unknown> | null): string | null {
  if (!video) return null

  const fromPlayAddr = pickTikTokUrlList(video.play_addr)
  if (fromPlayAddr) return fromPlayAddr

  const bitRates = video.bit_rate
  if (Array.isArray(bitRates)) {
    for (const entry of bitRates) {
      const br = asRecord(entry)
      const url = pickTikTokUrlList(br?.play_addr)
      if (url) return url
    }
  }

  return pickTikTokUrlList(video.download_addr)
}
