import fs from "fs"
import type { NotionCampaignDraft } from "@/lib/services/notion/campaigns"
import {
  loadCampaignConfigByName,
  mergeNotionIntoCampaignConfig,
} from "./campaign-config-loader"
import type { TikTokLaunchCampaignConfig } from "./launch-campaign-types"
import {
  applyVideosDirectoryToConfig,
  buildAdgroupsOneConjuntoPerVideo,
  buildVariantFolderSummary,
  collectNotionUrlsForSummary,
  filterLaunchableAdgroups,
  normalizeVideosDirectory,
  type VariantFolderSummary,
} from "./video-path"

export type LaunchCheckItem = {
  ok: boolean
  label: string
  detail?: string
}

export type LaunchPreflightResult = {
  ready: boolean
  draftName: string
  configCampaignName: string
  videosDirectory: string
  checks: LaunchCheckItem[]
  variants: VariantFolderSummary[]
  launchableAds: number
  skippedAds: number
  adGroupCount: number
  urlGroupsNeeded: number
}

function countUniqueUrlGroups(cfg: TikTokLaunchCampaignConfig): number {
  const defaultUrl = cfg.campaign.default_url ?? ""
  return new Set(
    cfg.adgroups.map((ag) => ag.url ?? defaultUrl).filter(Boolean)
  ).size
}

export function buildLaunchPreflight(
  draft: NotionCampaignDraft,
  videosDir: string
): LaunchPreflightResult {
  const checks: LaunchCheckItem[] = []
  const normalizedDir = normalizeVideosDirectory(videosDir)

  checks.push({
    ok: Boolean(draft.name),
    label: "Nombre en Notion",
    detail: draft.name || "Sin título",
  })

  if (draft.platform && draft.platform !== "TikTok") {
    checks.push({
      ok: false,
      label: "Plataforma",
      detail: `${draft.platform} (debe ser TikTok)`,
    })
  } else {
    checks.push({
      ok: true,
      label: "Plataforma",
      detail: draft.platform ?? "TikTok",
    })
  }

  let baseConfig: TikTokLaunchCampaignConfig
  try {
    baseConfig = loadCampaignConfigByName(draft.name)
    checks.push({
      ok: true,
      label: "Config JSON",
      detail: baseConfig.campaign.name,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Config no encontrado"
    checks.push({ ok: false, label: "Config JSON", detail: msg })
    return {
      ready: false,
      draftName: draft.name,
      configCampaignName: "",
      videosDirectory: normalizedDir,
      checks,
      variants: [],
      launchableAds: 0,
      skippedAds: 0,
      adGroupCount: 0,
      urlGroupsNeeded: 0,
    }
  }

  const cfg = mergeNotionIntoCampaignConfig(baseConfig, {
    dailyBudget: draft.dailyBudget,
    urls: draft.urls,
  })

  const urlGroupsNeeded = countUniqueUrlGroups(cfg)
  const budget = draft.dailyBudget ?? cfg.campaign.daily_budget ?? null

  checks.push({
    ok: budget != null && budget > 0,
    label: "Presupuesto diario",
    detail:
      budget != null && budget > 0
        ? `S/ ${budget}`
        : "Falta en Notion y en el JSON",
  })

  checks.push({
    ok: draft.urls.length > 0 || Boolean(cfg.campaign.default_url),
    label: "URLs",
    detail:
      draft.urls.length > 0
        ? `${draft.urls.length} URL(s) en Notion`
        : cfg.campaign.default_url
          ? "URLs del JSON"
          : "Faltan URLs",
  })

  const notionUrls = collectNotionUrlsForSummary(draft.urls, cfg)
  const useNotionVariants = notionUrls.length > 0

  if (!useNotionVariants && draft.urls.length > 0 && draft.urls.length < urlGroupsNeeded) {
    checks.push({
      ok: false,
      label: "URLs vs conjuntos",
      detail: `Notion ${draft.urls.length} · config ${urlGroupsNeeded}`,
    })
  }

  checks.push({
    ok: Boolean(normalizedDir),
    label: "Carpeta de videos",
    detail: normalizedDir || "Indica la carpeta",
  })

  if (normalizedDir) {
    checks.push({
      ok: fs.existsSync(normalizedDir),
      label: "Carpeta accesible",
      detail: fs.existsSync(normalizedDir)
        ? normalizedDir
        : "No visible desde el servidor (WSL: /mnt/d/...)",
    })
  }

  const variants = buildVariantFolderSummary(notionUrls, normalizedDir)
  let launchableAds = 0
  let skippedAds = 0
  let adGroupCount = cfg.adgroups.length

  if (useNotionVariants) {
    launchableAds = variants.reduce((n, v) => n + v.videoCount, 0)
    skippedAds = Math.max(0, notionUrls.length - variants.length)
    adGroupCount = launchableAds
    if (normalizedDir && launchableAds > 0) {
      try {
        buildAdgroupsOneConjuntoPerVideo(variants, normalizedDir)
      } catch (e) {
        checks.push({
          ok: false,
          label: "Videos por archivo",
          detail: e instanceof Error ? e.message : "Error al emparejar videos",
        })
      }
    }
  } else {
    const cfgWithVideos = normalizedDir
      ? applyVideosDirectoryToConfig(cfg, normalizedDir)
      : cfg
    const launchable = filterLaunchableAdgroups(cfgWithVideos)
    launchableAds = launchable.adgroups.length
    skippedAds = cfg.adgroups.length - launchableAds
    adGroupCount = cfg.adgroups.length
  }

  checks.push({
    ok: launchableAds > 0,
    label: "Listo para publicar",
    detail:
      launchableAds > 0
        ? `${launchableAds} conjunto(s) (= ${launchableAds} video(s), 1 por conjunto)${skippedAds > 0 ? ` · ${skippedAds} URL(s) sin video` : ""}`
        : "Ningún video en carpeta para las URLs de Notion",
  })

  const blocking = checks.filter(
    (c) =>
      !c.ok &&
      c.label !== "Listo para publicar"
  )
  const ready = blocking.length === 0 && launchableAds > 0

  return {
    ready,
    draftName: draft.name,
    configCampaignName: cfg.campaign.name,
    videosDirectory: normalizedDir,
    checks,
    variants,
    launchableAds,
    skippedAds,
    adGroupCount,
    urlGroupsNeeded,
  }
}
