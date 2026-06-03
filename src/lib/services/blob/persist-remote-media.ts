import { put } from "@vercel/blob"
import {
  assertBlobConfigured,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  sanitizeFilename,
} from "@/lib/services/blob/media-utils"

const DEFAULT_TIMEOUT_MS = 60_000

const BLOB_HOST_RE = /blob\.vercel-storage\.com/i

export function isVercelBlobUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false
  return BLOB_HOST_RE.test(url.trim())
}

export type PersistRemoteMediaInput = {
  remoteUrl: string
  blobPath: string
  kind: "image" | "video"
  referer?: string
  timeoutMs?: number
}

function extensionForContentType(
  contentType: string | null,
  kind: "image" | "video"
): string {
  const ct = (contentType ?? "").split(";")[0]?.trim().toLowerCase() ?? ""
  if (ct.includes("jpeg") || ct.includes("jpg")) return ".jpg"
  if (ct.includes("png")) return ".png"
  if (ct.includes("webp")) return ".webp"
  if (ct.includes("gif")) return ".gif"
  if (ct.includes("webm")) return ".webm"
  if (ct.includes("quicktime")) return ".mov"
  if (ct.includes("mp4") || ct.includes("video")) return ".mp4"
  return kind === "image" ? ".jpg" : ".mp4"
}

function refererForUrl(url: string, explicit?: string): string | undefined {
  if (explicit) return explicit
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (host.includes("tiktok") || host.includes("tiktokcdn")) {
      return "https://www.tiktok.com/"
    }
    if (
      host.includes("instagram") ||
      host.includes("cdninstagram") ||
      host.includes("fbcdn")
    ) {
      return "https://www.instagram.com/"
    }
  } catch {
    // ignore
  }
  return undefined
}

export async function persistRemoteMediaToBlob(
  input: PersistRemoteMediaInput
): Promise<string | null> {
  const remoteUrl = input.remoteUrl.trim()
  if (!remoteUrl) return null
  if (isVercelBlobUrl(remoteUrl)) return remoteUrl

  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    console.warn(
      "[persist-remote-media] BLOB_READ_WRITE_TOKEN no configurado; se omite persistencia."
    )
    return null
  }

  assertBlobConfigured()

  const maxBytes = input.kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    input.timeoutMs ?? DEFAULT_TIMEOUT_MS
  )

  try {
    const referer = refererForUrl(remoteUrl, input.referer)
    const headers: HeadersInit = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    }
    if (referer) headers.Referer = referer

    const response = await fetch(remoteUrl, {
      signal: controller.signal,
      headers,
      redirect: "follow",
    })

    if (!response.ok) {
      console.warn(
        `[persist-remote-media] HTTP ${response.status} al descargar ${remoteUrl.slice(0, 80)}`
      )
      return null
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length === 0) {
      console.warn("[persist-remote-media] respuesta vacía:", remoteUrl.slice(0, 80))
      return null
    }
    if (buffer.length > maxBytes) {
      console.warn(
        `[persist-remote-media] archivo demasiado grande (${buffer.length} bytes): ${input.blobPath}`
      )
      return null
    }

    const contentType = response.headers.get("content-type")
    const ext = extensionForContentType(contentType, input.kind)
    const pathBase = input.blobPath.replace(/\.[a-z0-9]+$/i, "")
    const pathname = `${pathBase}${ext}`

    const token = process.env.BLOB_READ_WRITE_TOKEN!
    const blob = await put(pathname, buffer, {
      access: "public",
      token,
      contentType:
        contentType?.split(";")[0]?.trim() ||
        (input.kind === "image" ? "image/jpeg" : "video/mp4"),
    })

    return blob.url
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(
      `[persist-remote-media] fallo al persistir ${input.blobPath}: ${message}`
    )
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  if (items.length === 0) return []
  const limit = Math.max(1, concurrency)
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (true) {
      const i = nextIndex++
      if (i >= items.length) break
      results[i] = await fn(items[i]!, i)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  )
  return results
}

export function buildScrapedMediaPath(
  segments: Array<string | null | undefined>,
  filename: string
): string {
  const safeParts = segments
    .map((s) => (s ? sanitizeFilename(String(s)) : ""))
    .filter(Boolean)
  return `scraped/${safeParts.join("/")}/${sanitizeFilename(filename)}`
}
