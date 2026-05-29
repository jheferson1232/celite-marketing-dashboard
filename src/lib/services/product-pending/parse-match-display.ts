import type { PendingProductMatchRecord } from "./types"
import {
  asRecord,
  pickString,
} from "@/lib/services/sociavault/sociavault-parse-utils"
import {
  extractTikTokCoverUrl,
  extractTikTokVideoUrl,
} from "@/lib/services/sociavault/tiktok-media-urls"

export type MatchDisplayInfo = {
  platform: "instagram" | "tiktok"
  pageName: string | null
  authorHandle: string | null
  externalId: string | null
  title: string | null
  bodyText: string | null
  coverUrl: string | null
  videoUrl: string | null
  playCount: number | null
  likeCount: number | null
  commentCount: number | null
  publishedAt: string | null
  statusLabel: string | null
  landingUrl: string | null
  searchQuery: string | null
  score: number
}

function pickNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim()) {
      const n = Number(value)
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

function formatUnixDate(seconds: number | null): string | null {
  if (seconds == null || seconds <= 0) return null
  const ms = seconds > 1e12 ? seconds : seconds * 1000
  try {
    return new Date(ms).toLocaleDateString("es-CO", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  } catch {
    return null
  }
}

function formatCount(n: number | null): string | null {
  if (n == null) return null
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function formatMatchPlayCount(info: MatchDisplayInfo): string | null {
  return formatCount(info.playCount)
}

export function formatMatchLikeCount(info: MatchDisplayInfo): string | null {
  return formatCount(info.likeCount)
}

export function formatMatchCommentCount(info: MatchDisplayInfo): string | null {
  return formatCount(info.commentCount)
}

export function parseMatchDisplay(
  match: PendingProductMatchRecord
): MatchDisplayInfo {
  const payload = match.payload
  const platform =
    payload.platform === "instagram" || payload.platform === "tiktok"
      ? payload.platform
      : "tiktok"

  if (platform === "tiktok") {
    const statistics = asRecord(payload.statistics)
    const author = asRecord(payload.author) ?? asRecord(payload.authorMeta)
    const video = asRecord(payload.video)
    const createTime = pickNumber(payload.create_time)

    return {
      platform: "tiktok",
      pageName: match.pageName ?? pickString(author?.nickname),
      authorHandle: pickString(author?.unique_id),
      externalId: match.externalId,
      title: match.title,
      bodyText: pickString(payload.desc, payload.description, match.title),
      coverUrl:
        match.previewUrl ??
        pickString(payload.coverUrl) ??
        extractTikTokCoverUrl(video) ??
        pickString(payload.cover, payload.cover_url),
      videoUrl:
        pickString(payload.videoUrl) ?? extractTikTokVideoUrl(video),
      playCount: pickNumber(
        statistics?.play_count,
        statistics?.playCount,
        payload.play_count
      ),
      likeCount: pickNumber(
        statistics?.digg_count,
        statistics?.diggCount,
        payload.digg_count
      ),
      commentCount: pickNumber(
        statistics?.comment_count,
        statistics?.commentCount,
        payload.comment_count
      ),
      publishedAt: formatUnixDate(createTime),
      statusLabel: "TikTok",
      landingUrl: match.landingUrl,
      searchQuery:
        typeof payload.searchQuery === "string"
          ? payload.searchQuery
          : pickString(payload.search_query, payload._searchQuery),
      score: match.score,
    }
  }

  const caption = pickString(
    payload.caption,
    payload.googleDescription,
    match.title
  )
  const ownerUsername = pickString(payload.ownerUsername)

  return {
    platform: "instagram",
    pageName:
      match.pageName ??
      (ownerUsername ? `@${ownerUsername.replace(/^@/, "")}` : null),
    authorHandle: ownerUsername?.replace(/^@/, "") ?? null,
    externalId: match.externalId,
    title: match.title ?? pickString(payload.googleTitle),
    bodyText: caption,
    coverUrl:
      match.previewUrl ??
      pickString(
        payload.coverUrl,
        payload.thumbnail_src,
        payload.googleThumbnail
      ),
    videoUrl: pickString(payload.videoUrl),
    playCount: pickNumber(payload.playCount, payload.video_play_count),
    likeCount: null,
    commentCount: null,
    publishedAt: null,
    statusLabel: "Instagram",
    landingUrl:
      match.landingUrl ??
      (match.externalId
        ? `https://www.instagram.com/reel/${match.externalId}/`
        : null),
    searchQuery:
      typeof payload.searchQuery === "string"
        ? payload.searchQuery
        : pickString(payload._searchQuery),
    score: match.score,
  }
}
