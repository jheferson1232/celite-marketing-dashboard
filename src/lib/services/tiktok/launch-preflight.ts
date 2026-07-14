import fs from "fs"
import { isCloudHosted } from "@/lib/deployment/cloud-host"
import type { TikTokLaunchDraft } from "./launch-draft"
import {
  buildBaseConfigFromDraft,
  mergeNotionIntoCampaignConfig,
} from "./launch-base-config"
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
  draft: TikTokLaunchDraft,
  videosDir: string
): LaunchPreflightResult {
  const checks: LaunchCheckItem[] = []
  const normalizedDir = normalizeVideosDirectory(videosDir)
  const sourceLabel = draft.source === "product" ? "Producto" : "Notion"
  const hasBlobVideos = (draft.blobVideoUrls?.length ?? 0) > 0

  checks.push({
    ok: Boolean(draft.name),
    label: `Nombre (${sourceLabel})`,
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

  const baseConfig = buildBaseConfigFromDraft(draft)
  checks.push({
    ok: true,
    label: "Config base",
    detail: baseConfig.campaign.name,
  })

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
        : draft.source === "product"
          ? "Falta en el producto y en el JSON"
          : "Falta en Notion y en el JSON",
  })

  checks.push({
    ok: draft.urls.length > 0 || Boolean(cfg.campaign.default_url),
    label: "URLs",
    detail:
      draft.urls.length > 0
        ? `${draft.urls.length} URL(s) en ${sourceLabel.toLowerCase()}`
        : cfg.campaign.default_url
          ? "URLs del JSON"
          : "Faltan URLs",
  })

  const draftUrls = collectNotionUrlsForSummary(draft.urls, cfg)
  const useUrlVariants = draftUrls.length > 0

  if (!useUrlVariants && draft.urls.length > 0 && draft.urls.length < urlGroupsNeeded) {
    checks.push({
      ok: false,
      label: "URLs vs conjuntos",
      detail: `${sourceLabel} ${draft.urls.length} · config ${urlGroupsNeeded}`,
    })
  }

  const onCloud = isCloudHosted()
  const productOnCloud = onCloud && draft.source === "product"

  if (hasBlobVideos && !normalizedDir) {
    const videoCount = draft.blobVideoUrls!.length
    const urlCount = draft.urls.length
    checks.push({
      ok: true,
      label: "Videos del producto",
      detail:
        urlCount > 0
          ? `${videoCount} video(s) en R2 → ${videoCount} conjunto(s) (1 por video, misma landing si hay 1 URL)`
          : `${videoCount} video(s) en R2 (se usarán al lanzar)`,
    })
  } else if (productOnCloud && !hasBlobVideos) {
    checks.push({
      ok: false,
      label: "Videos del producto",
      detail:
        "Sube archivos .mp4 en Editar producto (sección Videos). Se guardan en R2; la carpeta del PC no funciona en la web.",
    })
  }

  if (productOnCloud && normalizedDir) {
    checks.push({
      ok: false,
      label: "Carpeta local",
      detail:
        "En Vercel no se puede leer una ruta de tu PC. Quita la carpeta y usa videos subidos al producto.",
    })
  } else if (!productOnCloud) {
    checks.push({
      ok: Boolean(normalizedDir) || hasBlobVideos,
      label: "Carpeta de videos",
      detail: normalizedDir
        ? normalizedDir
        : hasBlobVideos
          ? "Opcional: videos desde Blob"
          : "Indica la carpeta o sube videos al producto",
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
  }

  const variants = buildVariantFolderSummary(draftUrls, normalizedDir)
  let launchableAds = 0
  let skippedAds = 0
  let adGroupCount = cfg.adgroups.length

  if (useUrlVariants) {
    launchableAds = variants.reduce((n, v) => n + v.videoCount, 0)
    skippedAds = Math.max(0, draftUrls.length - variants.length)
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

  const videosDetail =
    launchableAds > 0
      ? `${launchableAds} conjunto(s) (= ${launchableAds} video(s), 1 por conjunto)${skippedAds > 0 ? ` · ${skippedAds} URL(s) sin video` : ""}`
      : hasBlobVideos && draft.urls.length > 0
        ? "Los videos de R2 se emparejarán al lanzar"
        : productOnCloud
          ? "Sube videos .mp4 al producto antes de publicar"
          : "Ningún video en carpeta para las URLs"

  checks.push({
    ok: launchableAds > 0 || (hasBlobVideos && draft.urls.length > 0),
    label: "Listo para publicar",
    detail: videosDetail,
  })

  const blocking = checks.filter(
    (c) => !c.ok && c.label !== "Listo para publicar"
  )
  const ready =
    blocking.length === 0 &&
    (launchableAds > 0 || (hasBlobVideos && draft.urls.length > 0))

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
