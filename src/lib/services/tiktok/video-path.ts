import fs from "fs"
import path from "path"
import type { TikTokLaunchCampaignConfig } from "./launch-campaign-types"

/** Convierte `D:\calzados\tesla` a ruta usable en WSL (`/mnt/d/calzados/tesla`). */
export function normalizeVideosDirectory(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return trimmed

  const win = trimmed.match(/^([A-Za-z]):[\\/](.*)$/)
  if (win) {
    const drive = win[1].toLowerCase()
    const rest = win[2].replace(/\\/g, "/")
    if (process.platform === "win32") {
      return path.resolve(`${drive.toUpperCase()}:\\${rest.replace(/\//g, "\\")}`)
    }
    return `/mnt/${drive}/${rest}`
  }

  return path.resolve(trimmed)
}

export function getDefaultVideosDirectory(): string {
  const fromEnv = process.env.TIKTOK_VIDEOS_DEFAULT_DIR?.trim()
  if (fromEnv) return normalizeVideosDirectory(fromEnv)
  return ""
}

export function extractUrlSlug(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ""
  try {
    const u = new URL(
      trimmed.startsWith("http") ? trimmed : `https://${trimmed}`
    )
    const parts = u.pathname.split("/").filter(Boolean)
    return parts[parts.length - 1] ?? trimmed
  } catch {
    return trimmed.split("/").filter(Boolean).pop() ?? trimmed
  }
}

/** Clave comparable: sin espacios, guiones ni signos. */
export function normalizeMatchKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
}

function videoBasename(videoPath?: string): string | null {
  if (!videoPath?.trim()) return null
  return path.basename(videoPath.trim())
}

function variantLabelFromAdgroup(
  ag: { name: string; url?: string },
  defaultUrl: string
): string {
  const slug = extractUrlSlug(ag.url ?? defaultUrl)
  if (!slug) return ag.name
  const core = slug.replace(/^hertz-art-?/i, "").replace(/-/g, " ")
  return core || ag.name
}

/** Lista recursiva de .mp4 (hasta 2 niveles). */
export function scanMp4Files(rootDir: string, maxDepth = 2): string[] {
  const dir = normalizeVideosDirectory(rootDir)
  if (!dir || !fs.existsSync(dir)) return []

  const out: string[] = []

  function walk(current: string, depth: number) {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory() && depth < maxDepth) {
        walk(full, depth + 1)
      } else if (entry.isFile() && /\.mp4$/i.test(entry.name)) {
        out.push(full)
      }
    }
  }

  walk(dir, 0)
  return out
}

function scoreVideoMatch(
  filePath: string,
  opts: {
    expectedBasename?: string | null
    urlSlug?: string
    variantKey?: string
    adgroupName?: string
  }
): number {
  const bn = path.basename(filePath)
  const bnKey = normalizeMatchKey(bn)
  const pathKey = normalizeMatchKey(filePath)
  let score = 0

  if (opts.expectedBasename) {
    const expKey = normalizeMatchKey(opts.expectedBasename)
    if (bnKey === expKey) score += 100
    else if (bnKey.includes(expKey) || expKey.includes(bnKey)) score += 75
  }

  if (opts.urlSlug) {
    const slugKey = normalizeMatchKey(opts.urlSlug)
    if (slugKey && (pathKey.includes(slugKey) || bnKey.includes(slugKey))) {
      score += 60
    }
    const slugShort = slugKey.replace(/^hertzart/, "")
    if (slugShort && (bnKey.includes(slugShort) || pathKey.includes(slugShort))) {
      score += 40
    }
  }

  if (opts.variantKey) {
    const vKey = normalizeMatchKey(opts.variantKey)
    if (vKey && (bnKey.includes(vKey) || pathKey.includes(vKey))) score += 35
  }

  if (opts.adgroupName) {
    const agKey = normalizeMatchKey(opts.adgroupName.replace(/-/g, " "))
    if (agKey && bnKey.includes(agKey)) score += 30
  }

  return score
}

export function resolveVideoForAdgroup(
  videosDir: string,
  ag: { name: string; video?: string; url?: string },
  allFiles?: string[]
): string | null {
  const dir = normalizeVideosDirectory(videosDir)
  if (!dir) return null

  const files = allFiles ?? scanMp4Files(dir)
  const expectedBasename = videoBasename(ag.video)
  const urlSlug = ag.url ? extractUrlSlug(ag.url) : ""
  const variantKey = variantLabelFromAdgroup(ag, "")

  if (expectedBasename) {
    const direct = path.join(dir, expectedBasename)
    if (fs.existsSync(direct)) return direct
    const caseMatch = files.find(
      (f) =>
        path.basename(f).toLowerCase() === expectedBasename.toLowerCase()
    )
    if (caseMatch) return caseMatch
  }

  if (urlSlug) {
    const subDir = path.join(dir, urlSlug)
    if (fs.existsSync(subDir) && fs.statSync(subDir).isDirectory()) {
      const inSub = scanMp4Files(subDir, 0)
      if (inSub.length === 1) return inSub[0]!
      if (expectedBasename) {
        const m = inSub.find(
          (f) =>
            path.basename(f).toLowerCase() === expectedBasename.toLowerCase()
        )
        if (m) return m
      }
      if (inSub.length > 0) {
        const sorted = [...inSub].sort((a, b) =>
          path.basename(a).localeCompare(path.basename(b), "es")
        )
        return sorted[0]!
      }
    }
  }

  let best: { file: string; score: number } | null = null
  for (const file of files) {
    const score = scoreVideoMatch(file, {
      expectedBasename,
      urlSlug,
      variantKey,
      adgroupName: ag.name,
    })
    if (score >= 50 && (!best || score > best.score)) {
      best = { file, score }
    }
  }

  return best?.file ?? null
}

export function applyVideosDirectoryToConfig(
  cfg: TikTokLaunchCampaignConfig,
  videosDir: string
): TikTokLaunchCampaignConfig {
  const dir = normalizeVideosDirectory(videosDir)
  if (!dir) return cfg

  const allFiles = scanMp4Files(dir)
  const next = structuredClone(cfg)
  next.adgroups = next.adgroups.map((ag) => {
    const resolved = resolveVideoForAdgroup(dir, ag, allFiles)
    if (resolved) return { ...ag, video: resolved }
    const base = videoBasename(ag.video)
    return base ? { ...ag, video: path.join(dir, base) } : ag
  })
  return next
}

export function filterLaunchableAdgroups(
  cfg: TikTokLaunchCampaignConfig
): TikTokLaunchCampaignConfig {
  const next = structuredClone(cfg)
  next.adgroups = next.adgroups.filter(
    (ag) =>
      Boolean(ag.video_id) ||
      (ag.video != null && fs.existsSync(ag.video))
  )
  return next
}

export type VideoResolveRow = {
  adgroup: string
  variant: string
  urlSlug: string
  expectedFile: string
  resolvedPath: string | null
  found: boolean
}

export function listVideoResolveStatus(
  cfg: TikTokLaunchCampaignConfig,
  videosDir: string
): VideoResolveRow[] {
  const dir = normalizeVideosDirectory(videosDir)
  const defaultUrl = cfg.campaign.default_url ?? ""
  const allFiles = dir ? scanMp4Files(dir) : []

  return cfg.adgroups.map((ag) => {
    const expectedFile = videoBasename(ag.video) ?? ag.name
    const urlSlug = extractUrlSlug(ag.url ?? defaultUrl)
    const resolvedPath = dir
      ? resolveVideoForAdgroup(dir, ag, allFiles)
      : ag.video && fs.existsSync(ag.video)
        ? ag.video
        : null
    return {
      adgroup: ag.name,
      variant: variantLabelFromAdgroup(ag, defaultUrl),
      urlSlug,
      expectedFile,
      resolvedPath,
      found: Boolean(resolvedPath && fs.existsSync(resolvedPath)),
    }
  })
}

export type VariantFolderSummary = {
  variant: string
  urlSlug: string
  url: string
  videoCount: number
  folderVideos: string[]
}

type SlugVariantRule = {
  label: string
  include: string[]
  exclude: string[]
}

function parseSlugVariant(slug: string): SlugVariantRule {
  const core = slug.replace(/^hertz-art-/i, "")
  switch (core) {
    case "morado":
      return { label: "morado", include: ["morado"], exclude: ["negro", "blanco"] }
    case "negro-morado":
      return {
        label: "negro morado",
        include: ["negro", "morado"],
        exclude: [],
      }
    case "negro-blanco":
      return {
        label: "negro/blanco",
        include: ["negro", "blanco"],
        exclude: [],
      }
    case "blanco-negro":
      return {
        label: "blanco",
        include: ["blanco"],
        exclude: ["negro", "morado"],
      }
    default: {
      const label = core.replace(/-/g, " ")
      return {
        label,
        include: label.split(/\s+/).filter(Boolean),
        exclude: [],
      }
    }
  }
}

/** Cuenta .mp4 en carpeta que pertenecen a esta URL (sin mezclar variantes). */
export function listMp4BasenamesForUrlSlug(
  allFiles: string[],
  slug: string
): string[] {
  const { include, exclude } = parseSlugVariant(slug)
  const matched = allFiles.filter((filePath) => {
    const key = normalizeMatchKey(path.basename(filePath))
    if (exclude.some((token) => key.includes(normalizeMatchKey(token)))) {
      return false
    }
    return include.every((token) => key.includes(normalizeMatchKey(token)))
  })
  return [...new Set(matched.map((f) => path.basename(f)))].sort((a, b) =>
    a.localeCompare(b, "es")
  )
}

/** Una fila por URL de Notion; solo variantes con al menos un video en carpeta. */
export function buildVariantFolderSummary(
  notionUrls: string[],
  videosDir: string
): VariantFolderSummary[] {
  const dir = normalizeVideosDirectory(videosDir)
  const allFiles = dir ? scanMp4Files(dir) : []
  const seenSlugs = new Set<string>()
  const rows: VariantFolderSummary[] = []

  for (const url of notionUrls) {
    const slug = extractUrlSlug(url)
    if (!slug || seenSlugs.has(slug)) continue
    seenSlugs.add(slug)

    const folderVideos = listMp4BasenamesForUrlSlug(allFiles, slug)
    if (folderVideos.length === 0) continue

    rows.push({
      variant: parseSlugVariant(slug).label,
      urlSlug: slug,
      url,
      videoCount: folderVideos.length,
      folderVideos,
    })
  }

  return rows
}

export function collectNotionUrlsForSummary(
  draftUrls: string[],
  cfg: TikTokLaunchCampaignConfig
): string[] {
  if (draftUrls.length > 0) return draftUrls
  const defaultUrl = cfg.campaign.default_url ?? ""
  return [
    ...new Set(
      cfg.adgroups.map((ag) => ag.url ?? defaultUrl).filter(Boolean)
    ),
  ]
}

function ensureLandingUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return trimmed
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed
  }
  return `https://${trimmed}`
}

function adgroupNameFromVideoFile(basename: string): string {
  return basename
    .replace(/\.mp4$/i, "")
    .replace(/[/:]/g, "-")
    .replace(/\s+/g, "-")
    .toLowerCase()
}

/** Un conjunto TikTok por cada .mp4 (1 video = 1 conjunto, misma URL de la variante). */
export function buildAdgroupsOneConjuntoPerVideo(
  variants: VariantFolderSummary[],
  videosDir: string
): TikTokLaunchCampaignConfig["adgroups"] {
  const dir = normalizeVideosDirectory(videosDir)
  const allFiles = dir ? scanMp4Files(dir) : []
  const adgroups: TikTokLaunchCampaignConfig["adgroups"] = []
  const usedNames = new Set<string>()

  for (const variant of variants) {
    const landingUrl = ensureLandingUrl(variant.url)

    for (const basename of variant.folderVideos) {
      const videoPath = allFiles.find(
        (f) => path.basename(f).toLowerCase() === basename.toLowerCase()
      )
      if (!videoPath) continue

      let name = adgroupNameFromVideoFile(basename)
      if (usedNames.has(name)) {
        const slug =
          variant.urlSlug.replace(/^hertz-art-/i, "") || variant.variant
        name = `${slug.replace(/\//g, "-")}-${name}`
      }
      usedNames.add(name)

      adgroups.push({
        name,
        video: videoPath,
        url: landingUrl,
      })
    }
  }

  if (adgroups.length === 0) {
    throw new Error("No se encontraron archivos de video en la carpeta.")
  }

  return adgroups
}
