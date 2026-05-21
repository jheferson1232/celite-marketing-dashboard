import {
  getNotionCampaignDraftByPageId,
  listNotionCampaignDrafts,
  markNotionCampaignLaunched,
  type NotionCampaignDraft,
} from "@/lib/services/notion/campaigns"
import {
  loadCampaignConfigByName,
  mergeNotionIntoCampaignConfig,
} from "./campaign-config-loader"
import { buildLaunchPreflight, type LaunchPreflightResult } from "./launch-preflight"
import { launchTikTokCampaign } from "./launch-campaign"
import type { TikTokLaunchResult } from "./launch-campaign-types"
import {
  applyVideosDirectoryToConfig,
  buildAdgroupsOneConjuntoPerVideo,
  buildVariantFolderSummary,
  collectNotionUrlsForSummary,
  filterLaunchableAdgroups,
  getDefaultVideosDirectory,
} from "./video-path"

export type LaunchFromNotionSummary = {
  notionPageId: string
  campaignName: string
  urlsApplied: string[]
  dailyBudget: number | null
  videosDirectory: string
  skippedAds: number
  variantSummary: ReturnType<typeof buildVariantFolderSummary>
  result: TikTokLaunchResult
}

export type LaunchFromNotionOptions = {
  videosDir?: string
}

function formatLaunchMessage(summary: LaunchFromNotionSummary): string {
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
    summary.videosDirectory ? `\nCarpeta: ${summary.videosDirectory}` : "",
  ]

  return lines.filter(Boolean).join("")
}

function prepareConfigFromDraft(
  draft: NotionCampaignDraft,
  videosDir: string
): {
  cfg: ReturnType<typeof mergeNotionIntoCampaignConfig>
  variantSummary: ReturnType<typeof buildVariantFolderSummary>
  skippedAds: number
} {
  const baseConfig = loadCampaignConfigByName(draft.name)
  let cfg = mergeNotionIntoCampaignConfig(baseConfig, {
    dailyBudget: draft.dailyBudget,
    urls: draft.urls,
  })

  if (draft.name.trim()) {
    cfg.campaign.name = draft.name.trim()
  }

  const notionUrls = collectNotionUrlsForSummary(draft.urls, cfg)

  if (notionUrls.length > 0) {
    const variantSummary = buildVariantFolderSummary(notionUrls, videosDir)
    if (variantSummary.length === 0) {
      throw new Error(
        "No hay videos en la carpeta para las URLs de Notion."
      )
    }
    cfg.adgroups = buildAdgroupsOneConjuntoPerVideo(variantSummary, videosDir)
    const skippedAds = Math.max(0, notionUrls.length - variantSummary.length)
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

export async function previewLaunchFromNotionPage(
  pageId: string,
  videosDir: string
): Promise<LaunchPreflightResult> {
  const draft = await getNotionCampaignDraftByPageId(pageId)
  if (!draft) {
    throw new Error("No se encontró la página en Notion o no está en Borrador.")
  }
  return buildLaunchPreflight(draft, videosDir)
}

export async function launchTikTokCampaignFromNotionPage(
  pageId: string,
  options: LaunchFromNotionOptions = {}
): Promise<{ message: string; summary: LaunchFromNotionSummary }> {
  const draft = await getNotionCampaignDraftByPageId(pageId)
  if (!draft) {
    throw new Error("No se encontró la página en Notion o no está en Borrador.")
  }

  const videosDir =
    options.videosDir?.trim() || getDefaultVideosDirectory() || ""
  const preflight = buildLaunchPreflight(draft, videosDir)
  if (!preflight.ready) {
    const missing = preflight.checks
      .filter((c) => !c.ok)
      .map((c) => `• ${c.label}: ${c.detail ?? "—"}`)
      .join("\n")
    throw new Error(`No se puede lanzar todavía:\n${missing}`)
  }

  const summary = await launchTikTokCampaignFromDraft(draft, { videosDir })
  return {
    message: formatLaunchMessage(summary),
    summary,
  }
}

export async function launchTikTokCampaignFromDraft(
  draft: NotionCampaignDraft,
  options: LaunchFromNotionOptions = {}
): Promise<LaunchFromNotionSummary> {
  if (draft.platform && draft.platform !== "TikTok") {
    throw new Error(
      `La campaña "${draft.name}" es de ${draft.platform}, no TikTok.`
    )
  }

  const videosDir =
    options.videosDir?.trim() || getDefaultVideosDirectory() || ""

  const { cfg, variantSummary, skippedAds } = prepareConfigFromDraft(
    draft,
    videosDir
  )

  const result = await launchTikTokCampaign(cfg)
  await markNotionCampaignLaunched(draft.pageId, {
    campaignId: result.campaignId,
    adGroupCount: result.adGroupCount,
  })

  return {
    notionPageId: draft.pageId,
    campaignName: draft.name,
    urlsApplied: draft.urls,
    dailyBudget: draft.dailyBudget,
    videosDirectory: videosDir,
    skippedAds,
    variantSummary,
    result,
  }
}

export async function listNotionDraftsForPicker(): Promise<NotionCampaignDraft[]> {
  return listNotionCampaignDrafts()
}

export function formatNotionDraftPickerMessage(
  drafts: NotionCampaignDraft[]
): string {
  if (drafts.length === 0) {
    return "No hay campañas en **Borrador** en Notion."
  }
  const lines = drafts.map((d) => {
    const budget =
      d.dailyBudget != null ? `S/ ${d.dailyBudget}` : "sin presupuesto"
    const urls = d.urls.length > 0 ? `${d.urls.length} URL(s)` : "sin URLs"
    return `• **${d.name}** — ${budget} · ${urls}`
  })
  return `**Borradores en Notion (${drafts.length})**\n\n${lines.join("\n")}`
}
