import {
  buildBaseConfigFromDraft,
  mergeNotionIntoCampaignConfig,
} from "./launch-base-config"
import type { TikTokLaunchDraft } from "./launch-draft"
import { buildLaunchPreflight, type LaunchPreflightResult } from "./launch-preflight"
import { launchTikTokCampaign } from "./launch-campaign"
import type { TikTokLaunchResult } from "./launch-campaign-types"
import {
  resolveVideosDirectoryForLaunchDraft,
  type StagedVideosDirectory,
} from "./stage-product-videos"
import {
  applyVideosDirectoryToConfig,
  buildAdgroupsOneConjuntoPerVideo,
  buildVariantFolderSummary,
  collectNotionUrlsForSummary,
  filterLaunchableAdgroups,
  getDefaultVideosDirectory,
  normalizeVideosDirectory,
} from "./video-path"

export type LaunchCampaignSummary = {
  draftId: string
  campaignName: string
  urlsApplied: string[]
  dailyBudget: number | null
  videosDirectory: string
  videosStagedFromBlob: boolean
  skippedAds: number
  variantSummary: ReturnType<typeof buildVariantFolderSummary>
  result: TikTokLaunchResult
}

export type LaunchCampaignOptions = {
  videosDir?: string
}

function prepareConfigFromLaunchDraft(
  draft: TikTokLaunchDraft,
  videosDir: string
): {
  cfg: ReturnType<typeof mergeNotionIntoCampaignConfig>
  variantSummary: ReturnType<typeof buildVariantFolderSummary>
  skippedAds: number
} {
  const baseConfig = buildBaseConfigFromDraft(draft)
  let cfg = mergeNotionIntoCampaignConfig(baseConfig, {
    dailyBudget: draft.dailyBudget,
    urls: draft.urls,
  })

  if (draft.name.trim()) {
    cfg.campaign.name = draft.name.trim()
  }

  const draftUrls = collectNotionUrlsForSummary(draft.urls, cfg)

  if (draftUrls.length > 0) {
    const variantSummary = buildVariantFolderSummary(draftUrls, videosDir)
    if (variantSummary.length === 0) {
      throw new Error(
        "No hay videos en la carpeta para las URLs del producto."
      )
    }
    cfg.adgroups = buildAdgroupsOneConjuntoPerVideo(variantSummary, videosDir)
    const skippedAds = Math.max(0, draftUrls.length - variantSummary.length)
    return { cfg, variantSummary, skippedAds }
  }

  if (videosDir) {
    cfg = applyVideosDirectoryToConfig(cfg, videosDir)
  }
  const beforeCount = cfg.adgroups.length
  cfg = filterLaunchableAdgroups(cfg)
  const skippedAds = beforeCount - cfg.adgroups.length

  if (cfg.adgroups.length === 0) {
    throw new Error(
      "No hay videos que coincidan por nombre o URL en la carpeta indicada."
    )
  }

  return {
    cfg,
    variantSummary: buildVariantFolderSummary(
      collectNotionUrlsForSummary(draft.urls, cfg),
      videosDir
    ),
    skippedAds,
  }
}

export function formatLaunchCampaignMessage(summary: LaunchCampaignSummary): string {
  const { result } = summary
  const header = result.active
    ? "✅ Publicada en TikTok"
    : "⚠️ Creada en TikTok (en pausa)"

  const variantLines = summary.variantSummary
    .map(
      (v) =>
        `• ${v.variant} — ${v.videoCount} conjunto(s) (${v.folderVideos.join(", ")})`
    )
    .join("\n")

  const lines = [
    header,
    variantLines ? `\nVariantes publicadas:\n${variantLines}` : "",
    summary.dailyBudget != null
      ? `\nPresupuesto: S/ ${summary.dailyBudget}/día`
      : "",
    summary.videosStagedFromBlob
      ? "\nVideos: descargados desde el producto (Blob)"
      : summary.videosDirectory
        ? `\nCarpeta: ${summary.videosDirectory}`
        : "",
  ]

  return lines.filter(Boolean).join("")
}

async function resolveVideosDir(
  draft: TikTokLaunchDraft,
  userVideosDir: string
): Promise<StagedVideosDirectory> {
  const resolved = await resolveVideosDirectoryForLaunchDraft(
    draft,
    userVideosDir
  )
  return {
    ...resolved,
    dir: normalizeVideosDirectory(resolved.dir),
  }
}

export async function previewLaunchFromDraft(
  draft: TikTokLaunchDraft,
  userVideosDir: string
): Promise<LaunchPreflightResult> {
  const staged = await resolveVideosDir(draft, userVideosDir)
  try {
    return buildLaunchPreflight(draft, staged.dir)
  } finally {
    if (staged.staged) staged.cleanup()
  }
}

export async function launchTikTokCampaignFromLaunchDraft(
  draft: TikTokLaunchDraft,
  options: LaunchCampaignOptions = {},
  afterLaunch?: (result: TikTokLaunchResult) => Promise<void>
): Promise<LaunchCampaignSummary> {
  if (draft.platform && draft.platform !== "TikTok") {
    throw new Error(
      `La campaña "${draft.name}" es de ${draft.platform}, no TikTok.`
    )
  }

  const userVideosDir =
    options.videosDir?.trim() || getDefaultVideosDirectory() || ""

  const staged = await resolveVideosDir(draft, userVideosDir)
  const videosDir = staged.dir

  try {
    const preflight = buildLaunchPreflight(draft, videosDir)
    if (!preflight.ready) {
      const missing = preflight.checks
        .filter((c) => !c.ok)
        .map((c) => `• ${c.label}: ${c.detail ?? "—"}`)
        .join("\n")
      throw new Error(`No se puede lanzar todavía:\n${missing}`)
    }

    const { cfg, variantSummary, skippedAds } = prepareConfigFromLaunchDraft(
      draft,
      videosDir
    )

    const result = await launchTikTokCampaign(cfg)
    if (afterLaunch) {
      await afterLaunch(result)
    }

    return {
      draftId: draft.id,
      campaignName: draft.name,
      urlsApplied: draft.urls,
      dailyBudget: draft.dailyBudget,
      videosDirectory: videosDir,
      videosStagedFromBlob: staged.staged,
      skippedAds,
      variantSummary,
      result,
    }
  } finally {
    if (staged.staged) staged.cleanup()
  }
}
