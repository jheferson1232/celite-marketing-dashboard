import fs from "fs"
import os from "os"
import path from "path"
import type { TikTokLaunchDraft } from "./launch-draft"
import { extractUrlSlug } from "./video-path"

export type StagedVideosDirectory = {
  dir: string
  staged: boolean
  cleanup: () => void
}

function buildStagedVideoFilename(
  landingUrl: string,
  videoIndex: number,
  totalVideos: number,
  landingCount: number,
  usedNames: Set<string>
): string {
  const baseSlug = extractUrlSlug(landingUrl) || `video-${videoIndex + 1}`
  let filename =
    totalVideos > 1 && landingCount === 1
      ? videoIndex === 0
        ? `${baseSlug}.mp4`
        : `${baseSlug}-${videoIndex + 1}.mp4`
      : `${baseSlug}.mp4`

  let suffix = 2
  while (usedNames.has(filename)) {
    filename = `${baseSlug}-${suffix}.mp4`
    suffix++
  }
  usedNames.add(filename)
  return filename
}

/** Descarga cada video de Blob a disco: 1 archivo .mp4 por video (1 conjunto por video). */
export async function stageProductVideosFromBlob(
  urls: string[],
  videoUrls: string[]
): Promise<StagedVideosDirectory> {
  if (videoUrls.length === 0) {
    throw new Error("El producto no tiene videos subidos.")
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "celite-tiktok-"))
  const landingUrls =
    urls.length > 0 ? urls : ["https://placeholder.local/default"]
  const usedNames = new Set<string>()

  for (let i = 0; i < videoUrls.length; i++) {
    const videoUrl = videoUrls[i]!
    const landingUrl =
      landingUrls[i] ?? landingUrls[landingUrls.length - 1]!
    const filename = buildStagedVideoFilename(
      landingUrl,
      i,
      videoUrls.length,
      landingUrls.length,
      usedNames
    )

    const res = await fetch(videoUrl)
    if (!res.ok) {
      throw new Error(`No se pudo descargar el video (${res.status})`)
    }
    const buf = Buffer.from(await res.arrayBuffer())
    fs.writeFileSync(path.join(dir, filename), buf)
  }

  return {
    dir,
    staged: true,
    cleanup: () => {
      try {
        fs.rmSync(dir, { recursive: true, force: true })
      } catch {
        // ignore cleanup errors
      }
    },
  }
}

export async function resolveVideosDirectoryForLaunchDraft(
  draft: Pick<TikTokLaunchDraft, "urls" | "blobVideoUrls">,
  userVideosDir: string
): Promise<StagedVideosDirectory> {
  const trimmed = userVideosDir.trim()
  if (trimmed) {
    return {
      dir: trimmed,
      staged: false,
      cleanup: () => {},
    }
  }

  const blobVideos = draft.blobVideoUrls ?? []
  if (blobVideos.length > 0) {
    return stageProductVideosFromBlob(draft.urls, blobVideos)
  }

  return {
    dir: "",
    staged: false,
    cleanup: () => {},
  }
}
