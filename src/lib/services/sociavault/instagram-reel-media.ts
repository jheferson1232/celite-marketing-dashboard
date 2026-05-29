import axios from "axios"
import { getSociaVaultClient } from "./sociavault-client"
import {
  asRecord,
  pickString,
  valuesFromListOrMap,
} from "./sociavault-parse-utils"

export type InstagramReelMedia = {
  shortcode: string | null
  caption: string | null
  pageName: string | null
  ownerUsername: string | null
  coverUrl: string | null
  videoUrl: string | null
  playCount: number | null
}

function findShortcodeMedia(
  node: unknown,
  depth = 0
): Record<string, unknown> | null {
  if (depth > 10) return null
  const record = asRecord(node)
  if (!record) return null

  const nested = asRecord(record.xdt_shortcode_media)
  if (nested) return nested

  if (
    pickString(record.shortcode) &&
    (pickString(record.display_url, record.thumbnail_src) ||
      record.__typename === "XDTGraphVideo" ||
      record.__isXDTGraphMediaInterface === "XDTGraphVideo")
  ) {
    return record
  }

  for (const value of Object.values(record)) {
    const found = findShortcodeMedia(value, depth + 1)
    if (found) return found
  }

  return null
}

function captionFromMedia(media: Record<string, unknown>): string | null {
  const edges = asRecord(media.edge_media_to_caption)?.edges
  const list = Array.isArray(edges) ? edges : valuesFromListOrMap(edges)
  const first = asRecord(list[0])
  const node = asRecord(first?.node)
  return pickString(node?.text, media.caption)
}

function coverFromMedia(media: Record<string, unknown>): string | null {
  const direct = pickString(media.display_url, media.thumbnail_src)
  if (direct) return direct

  const resources = valuesFromListOrMap(media.display_resources)
  let best: { width: number; src: string } | null = null
  for (const item of resources) {
    const row = asRecord(item)
    const src = pickString(row?.src)
    const width = Number(row?.config_width)
    if (!src) continue
    if (!best || (Number.isFinite(width) && width > best.width)) {
      best = { width: Number.isFinite(width) ? width : 0, src }
    }
  }

  return best?.src ?? null
}

function videoUrlFromDashManifest(manifest: string): string | null {
  const match = manifest.match(/<BaseURL>([^<]+)<\/BaseURL>/i)
  if (!match?.[1]) return null
  return match[1]
    .replace(/&amp;/g, "&")
    .replace(/\\u0026/g, "&")
    .trim()
}

function videoFromMedia(media: Record<string, unknown>): string | null {
  const direct = pickString(media.video_url)
  if (direct) return direct

  const versions = valuesFromListOrMap(media.video_versions)
  let best: { type: number; url: string } | null = null
  for (const item of versions) {
    const row = asRecord(item)
    const url = pickString(row?.url)
    const type = Number(row?.type)
    if (!url) continue
    if (!best || (Number.isFinite(type) && type >= best.type)) {
      best = { type: Number.isFinite(type) ? type : 0, url }
    }
  }
  if (best?.url) return best.url

  const dashInfo = asRecord(media.dash_info)
  const manifest = pickString(dashInfo?.video_dash_manifest)
  if (manifest) {
    const fromDash = videoUrlFromDashManifest(manifest)
    if (fromDash) return fromDash
  }

  return null
}

export function parseInstagramPostInfo(
  data: unknown,
  fallbackShortcode?: string | null
): InstagramReelMedia | null {
  const media = findShortcodeMedia(data)
  if (!media) return null

  const owner = asRecord(media.owner)
  const playCountRaw = pickString(
    media.video_play_count,
    media.video_view_count,
    media.play_count
  )
  const playCount =
    playCountRaw && Number.isFinite(Number(playCountRaw))
      ? Number(playCountRaw)
      : null

  return {
    shortcode: pickString(media.shortcode, fallbackShortcode),
    caption: captionFromMedia(media),
    pageName: pickString(owner?.username, owner?.full_name),
    ownerUsername: pickString(owner?.username),
    coverUrl: coverFromMedia(media),
    videoUrl: videoFromMedia(media),
    playCount,
  }
}

export class SociaVaultInsufficientCreditsError extends Error {
  constructor() {
    super("Sin créditos SociaVault.")
    this.name = "SociaVaultInsufficientCreditsError"
  }
}

function isInsufficientCreditsError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false
  const data = error.response?.data as { error?: string } | undefined
  return data?.error === "Insufficient credits"
}

export async function fetchInstagramReelMedia(
  reelUrl: string,
  fallbackShortcode?: string | null
): Promise<InstagramReelMedia | null> {
  try {
    const client = getSociaVaultClient()
    const { data } = await client.get("/v1/scrape/instagram/post-info", {
      params: { url: reelUrl },
    })
    return parseInstagramPostInfo(data, fallbackShortcode)
  } catch (error) {
    if (isInsufficientCreditsError(error)) {
      throw new SociaVaultInsufficientCreditsError()
    }
    return null
  }
}

export function instagramReelUrl(shortcode: string): string {
  return `https://www.instagram.com/reel/${shortcode}/`
}
