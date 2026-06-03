import type { PendingMatchCandidate } from "@/lib/services/sociavault/search-pending-matches"
import { pickString } from "@/lib/services/sociavault/sociavault-parse-utils"
import { parseMatchDisplay } from "./parse-match-display"
import type { PendingProductMatchRecord } from "./types"

function normalizeToken(value: string): string {
  return value.trim().toLowerCase()
}

export function pendingMatchExclusionTokens(input: {
  platform?: string | null
  externalId?: string | null
  landingUrl?: string | null
  videoUrl?: string | null
}): string[] {
  const tokens = new Set<string>()
  const platform = input.platform?.trim() || "tiktok"

  if (input.externalId?.trim()) {
    const id = normalizeToken(input.externalId)
    tokens.add(`${platform}:id:${id}`)
    tokens.add(`id:${id}`)
  }
  if (input.landingUrl?.trim()) {
    tokens.add(`url:${normalizeToken(input.landingUrl)}`)
  }
  if (input.videoUrl?.trim()) {
    tokens.add(`video:${normalizeToken(input.videoUrl)}`)
  }

  return [...tokens]
}

export function candidateExclusionTokens(
  match: PendingMatchCandidate
): string[] {
  const videoUrl = pickString(match.payload.videoUrl)
  return pendingMatchExclusionTokens({
    platform: match.platform,
    externalId: match.externalId,
    landingUrl: match.landingUrl,
    videoUrl,
  })
}

export function recordExclusionTokens(
  match: PendingProductMatchRecord
): string[] {
  const info = parseMatchDisplay(match)
  const platform =
    match.payload.platform === "instagram" || match.payload.platform === "tiktok"
      ? match.payload.platform
      : "tiktok"
  return pendingMatchExclusionTokens({
    platform,
    externalId: match.externalId,
    landingUrl: match.landingUrl,
    videoUrl: info.videoUrl,
  })
}

export function exclusionTokensFromDbRow(row: {
  externalId: string | null
  landingUrl: string | null
  payload: unknown
}): string[] {
  const payload =
    row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : {}
  const platform =
    payload.platform === "instagram" || payload.platform === "tiktok"
      ? payload.platform
      : "tiktok"
  const videoUrl = pickString(payload.videoUrl)

  return pendingMatchExclusionTokens({
    platform,
    externalId: row.externalId,
    landingUrl: row.landingUrl,
    videoUrl,
  })
}

export function buildPendingMatchExclusionSet(
  tokensList: string[][]
): Set<string> {
  const excluded = new Set<string>()
  for (const tokens of tokensList) {
    for (const token of tokens) {
      excluded.add(token)
    }
  }
  return excluded
}

export function isPendingMatchExcluded(
  candidate: PendingMatchCandidate,
  excluded: Set<string>
): boolean {
  return candidateExclusionTokens(candidate).some((token) => excluded.has(token))
}

export function filterNewPendingMatchCandidates(
  candidates: PendingMatchCandidate[],
  excluded: Set<string>
): PendingMatchCandidate[] {
  if (excluded.size === 0) return candidates
  return candidates.filter((candidate) => !isPendingMatchExcluded(candidate, excluded))
}
