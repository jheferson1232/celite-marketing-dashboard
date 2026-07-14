import { getTikTokStrategy } from "@/lib/config/tiktok-strategies"
import type { TikTokLaunchDraft } from "./launch-draft"
import type { TikTokLaunchCampaignConfig } from "./launch-campaign-types"

/**
 * Construye la config base de lanzamiento TikTok desde los defaults de la
 * estrategia ABO (TS) + los datos del draft (Notion/producto).
 * Reemplaza al viejo loader de JSONs en `config/tiktok-campaigns/`.
 */
export function buildBaseConfigFromDraft(
  draft: TikTokLaunchDraft
): TikTokLaunchCampaignConfig {
  const strategy = getTikTokStrategy("ABO")
  const urls = draft.urls.map((u) => u.trim()).filter(Boolean)
  const defaultUrl = urls[0] ?? ""

  return {
    campaign: {
      ...strategy.staticDefaults.campaign,
      name: draft.name,
      daily_budget: draft.dailyBudget ?? 0,
      default_url: defaultUrl || undefined,
      ad_text: strategy.staticDefaults.adTextDefault,
    },
    ctas: strategy.staticDefaults.ctas,
    adgroups: urls.map((url) => ({ name: url, url })),
  }
}

/**
 * Superpone el presupuesto y las URLs del draft sobre la config base.
 * Si hay URLs, mapea cada URL original del config a la nueva del draft (por índice).
 */
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
