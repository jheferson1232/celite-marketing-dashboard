import {
  validateABODynamicFields,
  type ABOStrategyConfig,
} from "@/lib/config/tiktok-strategies"
import {
  getCampaignById,
  updateCampaignStatus,
  type CampaignRecord,
} from "@/lib/services/campaign"
import {
  getABOCampaignContext,
  toLaunchConfig,
} from "@/lib/services/campaign-strategy-builder"
import { launchTikTokCampaign } from "./launch-campaign"
import type {
  TikTokLaunchCampaignConfig,
  TikTokLaunchResult,
} from "./launch-campaign-types"
import { LaunchMetrics, logLaunchMetrics } from "./launch-metrics"
import {
  clearLaunchProgress,
  launchProgressMessage,
  setLaunchProgress,
} from "./launch-progress"
import type { LaunchCheckItem } from "./launch-preflight"
import { stageCampaignAdgroupVideosFromBlob } from "./stage-campaign-videos"
import { hasTikTokCredentialsConfigured } from "./tiktok-credentials.server"

export type CampaignLaunchPreflightResult = {
  ready: boolean
  campaignId: string
  campaignName: string
  strategy: string
  dailyBudget: number
  adGroupCount: number
  videoCount: number
  landingPageUrl: string
  adText: string
  adgroups: Array<{
    name: string
    videoLabel: string | null
    url: string
  }>
  checks: LaunchCheckItem[]
}

export type LaunchFromCampaignSummary = {
  campaignId: string
  campaignName: string
  adGroupCount: number
  videosStagedFromBlob: boolean
  result: TikTokLaunchResult
  metrics?: ReturnType<LaunchMetrics["finish"]>
}

const LAUNCHABLE_STATUSES = new Set(["draft", "ready"])

async function checkTikTokEnv(): Promise<LaunchCheckItem> {
  const ok = await hasTikTokCredentialsConfigured()
  return {
    ok,
    label: "Credenciales TikTok",
    detail: ok
      ? "Cuenta TikTok Ads conectada (BD o .env)"
      : "Conectá una cuenta en Cuentas TikTok Ads o configurá .env",
  }
}

export async function getCampaignForTikTokLaunch(
  campaignId: string
): Promise<CampaignRecord> {
  const campaign = await getCampaignById(campaignId)
  if (!campaign) {
    throw new Error("Campaña no encontrada")
  }
  if (!LAUNCHABLE_STATUSES.has(campaign.status)) {
    throw new Error(
      `La campaña debe estar en Borrador o Listo para lanzar (estado actual: ${campaign.status}).`
    )
  }
  if (campaign.strategy !== "ABO") {
    throw new Error(`Estrategia no soportada para lanzamiento: ${campaign.strategy}`)
  }
  return campaign
}

function buildLaunchConfigFromCampaign(
  campaign: CampaignRecord
): TikTokLaunchCampaignConfig {
  const launchConfig = toLaunchConfig(campaign.config)
  return {
    ...launchConfig,
    campaign: {
      ...launchConfig.campaign,
      name: campaign.name.trim() || launchConfig.campaign.name,
    },
  }
}

async function buildCampaignLaunchPreflight(
  campaign: CampaignRecord
): Promise<CampaignLaunchPreflightResult> {
  const checks: LaunchCheckItem[] = []
  const aboConfig = campaign.config as ABOStrategyConfig
  const context = getABOCampaignContext(aboConfig)

  checks.push({
    ok: Boolean(campaign.name.trim()),
    label: "Nombre de campaña",
    detail: campaign.name.trim() || "Sin nombre",
  })

  checks.push({
    ok: campaign.strategy === "ABO",
    label: "Estrategia",
    detail: campaign.strategy,
  })

  const validation = validateABODynamicFields(aboConfig.dynamic, context)
  if (!validation.valid) {
    for (const [field, message] of Object.entries(validation.errors)) {
      if (!message) continue
      checks.push({
        ok: false,
        label: `Config ABO (${field})`,
        detail: message,
      })
    }
  } else {
    checks.push({
      ok: true,
      label: "Configuración ABO",
      detail: "Válida",
    })
  }

  const launchCfg = buildLaunchConfigFromCampaign(campaign)
  const budget = launchCfg.campaign.daily_budget ?? 0
  checks.push({
    ok: budget > 0,
    label: "Presupuesto diario",
    detail: budget > 0 ? `${budget} COP/conjunto` : "Debe ser mayor a 0",
  })

  const landingUrl =
    launchCfg.campaign.default_url ??
    launchCfg.adgroups[0]?.url ??
    aboConfig.dynamic.landingPageUrl ??
    ""
  checks.push({
    ok: Boolean(landingUrl.trim()),
    label: "Landing page",
    detail: landingUrl.trim() || "Falta URL de destino",
  })

  const adText = launchCfg.campaign.ad_text ?? aboConfig.dynamic.adText ?? ""
  checks.push({
    ok: Boolean(adText.trim()),
    label: "Texto del anuncio",
    detail: adText.trim() ? "Configurado" : "Falta texto",
  })

  const videoAdgroups = launchCfg.adgroups.filter((ag) =>
    Boolean(ag.video?.trim() || ag.video_id)
  )
  checks.push({
    ok: videoAdgroups.length > 0,
    label: "Videos de creativos",
    detail:
      videoAdgroups.length > 0
        ? `${videoAdgroups.length} video(s) en Blob listos para subir`
        : "Se requiere al menos un video asociado",
  })

  checks.push(await checkTikTokEnv())

  const blocking = checks.filter((c) => !c.ok)
  const ready = blocking.length === 0 && launchCfg.adgroups.length > 0

  const defaultUrl = launchCfg.campaign.default_url ?? landingUrl

  return {
    ready,
    campaignId: campaign.id,
    campaignName: campaign.name,
    strategy: campaign.strategy,
    dailyBudget: budget,
    adGroupCount: launchCfg.adgroups.length,
    videoCount: videoAdgroups.length,
    landingPageUrl: landingUrl,
    adText,
    adgroups: launchCfg.adgroups.map((ag) => ({
      name: ag.name,
      videoLabel: ag.video?.split("/").pop() ?? ag.video_id ?? null,
      url: ag.url ?? defaultUrl,
    })),
    checks,
  }
}

export async function previewLaunchFromCampaign(
  campaignId: string
): Promise<CampaignLaunchPreflightResult> {
  const campaign = await getCampaignForTikTokLaunch(campaignId)
  return await buildCampaignLaunchPreflight(campaign)
}

export function formatLaunchFromCampaignMessage(
  summary: LaunchFromCampaignSummary
): string {
  const { result } = summary
  const header = result.active
    ? "Creada y activa en TikTok"
    : "Creada en TikTok (en pausa)"

  return [
    header,
    `Campaña: ${summary.campaignName}`,
    `Conjuntos: ${summary.adGroupCount}`,
    summary.videosStagedFromBlob
      ? "Videos: descargados desde creativos (Blob)"
      : "",
  ]
    .filter(Boolean)
    .join("\n")
}

export async function launchTikTokCampaignFromCampaign(
  campaignId: string
): Promise<{ message: string; summary: LaunchFromCampaignSummary }> {
  const metrics = new LaunchMetrics()
  let stagedCleanup: (() => void) | null = null

  setLaunchProgress(campaignId, {
    stage: "staging",
    current: 0,
    total: 0,
    message: launchProgressMessage("staging", 0, 0),
  })

  try {
    const campaign = await getCampaignForTikTokLaunch(campaignId)
    const preflight = await buildCampaignLaunchPreflight(campaign)

    if (!preflight.ready) {
      const missing = preflight.checks
        .filter((c) => !c.ok)
        .map((c) => `• ${c.label}: ${c.detail ?? "—"}`)
        .join("\n")
      throw new Error(`No se puede lanzar todavía:\n${missing}`)
    }

    let launchCfg = buildLaunchConfigFromCampaign(campaign)
    const { staged, adgroups } = await stageCampaignAdgroupVideosFromBlob(
      launchCfg.adgroups,
      { campaignId, metrics }
    )
    stagedCleanup = staged.cleanup
    launchCfg = { ...launchCfg, adgroups }

    const result = await launchTikTokCampaign(launchCfg, {
      progressCampaignId: campaignId,
      metrics,
    })

    await metrics.time("update_status", async () => {
      await updateCampaignStatus(campaignId, "running")
    })

    const metricsSnapshot = metrics.finish()
    logLaunchMetrics(campaignId, metricsSnapshot)

    const summary: LaunchFromCampaignSummary = {
      campaignId: campaign.id,
      campaignName: campaign.name,
      adGroupCount: result.adGroupCount,
      videosStagedFromBlob: staged.staged,
      result,
      metrics: metricsSnapshot,
    }

    return {
      message: formatLaunchFromCampaignMessage(summary),
      summary,
    }
  } catch (error) {
    setLaunchProgress(campaignId, {
      stage: "error",
      current: 0,
      total: metrics.counters.adgroupsTotal,
      message:
        error instanceof Error
          ? error.message
          : launchProgressMessage("error", 0, metrics.counters.adgroupsTotal),
    })
    throw error
  } finally {
    stagedCleanup?.()
    setTimeout(() => clearLaunchProgress(campaignId), 60_000)
  }
}
