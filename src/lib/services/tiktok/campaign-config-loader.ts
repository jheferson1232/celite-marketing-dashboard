import fs from "fs"
import path from "path"
import type { TikTokLaunchCampaignConfig } from "./launch-campaign-types"

function getConfigDirectory(): string {
  const fromEnv = process.env.TIKTOK_CAMPAIGN_CONFIG_DIR?.trim()
  if (fromEnv) return path.resolve(fromEnv)
  return path.join(process.cwd(), "config", "tiktok-campaigns")
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

export function listCampaignConfigNames(): string[] {
  const dir = getConfigDirectory()
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "ejemplo-meta.json")
    .map((f) => {
      const raw = fs.readFileSync(path.join(dir, f), "utf8")
      const cfg = JSON.parse(raw) as TikTokLaunchCampaignConfig
      return cfg.campaign.name
    })
}

export function loadCampaignConfigByName(
  campaignName: string
): TikTokLaunchCampaignConfig {
  const dir = getConfigDirectory()
  if (!fs.existsSync(dir)) {
    throw new Error(
      `No existe la carpeta de configs: ${dir}. Copia los JSON de dashboard-meta-ads/config.`
    )
  }

  const target = normalizeName(campaignName)
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "ejemplo-meta.json")

  for (const file of files) {
    const fullPath = path.join(dir, file)
    const cfg = JSON.parse(
      fs.readFileSync(fullPath, "utf8")
    ) as TikTokLaunchCampaignConfig
    if (normalizeName(cfg.campaign.name) === target) {
      return structuredClone(cfg)
    }
  }

  for (const file of files) {
    const fullPath = path.join(dir, file)
    const cfg = JSON.parse(
      fs.readFileSync(fullPath, "utf8")
    ) as TikTokLaunchCampaignConfig
    const cfgName = normalizeName(cfg.campaign.name)
    if (cfgName.includes(target) || target.includes(cfgName)) {
      return structuredClone(cfg)
    }
  }

  throw new Error(
    `No hay config JSON para "${campaignName}" en ${dir}. El nombre debe coincidir con campaign.name del archivo.`
  )
}

export function mergeNotionIntoCampaignConfig(
  cfg: TikTokLaunchCampaignConfig,
  options: { dailyBudget: number | null; urls: string[] }
): TikTokLaunchCampaignConfig {
  const next = structuredClone(cfg)

  if (options.dailyBudget != null && options.dailyBudget > 0) {
    next.campaign.daily_budget = options.dailyBudget
  }

  if (options.urls.length === 0) {
    return next
  }

  const defaultUrl = next.campaign.default_url ?? ""
  const uniqueOriginal = [
    ...new Set(
      next.adgroups.map((ag) => ag.url ?? defaultUrl).filter(Boolean)
    ),
  ]

  const urlByOriginal = new Map<string, string>()
  uniqueOriginal.forEach((orig, index) => {
    urlByOriginal.set(
      orig,
      options.urls[index] ?? options.urls[options.urls.length - 1] ?? orig
    )
  })

  next.adgroups = next.adgroups.map((ag) => {
    const key = ag.url ?? defaultUrl
    const mapped = urlByOriginal.get(key)
    return mapped ? { ...ag, url: mapped } : ag
  })

  if (!next.campaign.default_url && options.urls[0]) {
    next.campaign.default_url = options.urls[0]
  }

  return next
}
