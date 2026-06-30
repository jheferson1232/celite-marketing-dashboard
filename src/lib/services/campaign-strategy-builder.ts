import {
  getTikTokStrategy,
  isTikTokStrategyId,
  normalizeABODynamicFields,
  resolveEffectiveVideoCreatives,
  type ABODynamicCampaignContext,
  type ABODynamicFields,
  type ABOStrategyConfig,
  type CampaignStrategyConfig,
  type TikTokStrategyId,
} from "@/lib/config/tiktok-strategies"

export function getABOCampaignContext(
  config: ABOStrategyConfig
): ABODynamicCampaignContext {
  return {
    budget: 0,
    landingPages: config.landingPages ?? [],
    creatives: config.creatives ?? [],
  }
}

export function buildEmptyABOStrategyConfig(campaignName: string): ABOStrategyConfig {
  const strategy = getTikTokStrategy("ABO")

  return {
    strategy: "ABO",
    campaign: {
      ...strategy.staticDefaults.campaign,
      name: campaignName,
      daily_budget: 0,
      ad_text: strategy.staticDefaults.adTextDefault,
    },
    ctas: strategy.staticDefaults.ctas,
    adgroups: [],
    landingPages: [],
    creatives: [],
    dynamic: {
      variantId: "",
      variantName: "",
      budgetPerAdgroup: 0,
      autoCreateAdgroupsFromCreatives: true,
      selectedCreativeIds: [],
      landingPageId: null,
      landingPageUrl: "",
      adText: strategy.staticDefaults.adTextDefault,
    },
  }
}

function resolveVariantNameForAdgroups(
  dynamic: ABODynamicFields,
  context: ABODynamicCampaignContext
): string {
  if (dynamic.variantName.trim()) {
    return dynamic.variantName.trim()
  }

  const videos = resolveEffectiveVideoCreatives(context, dynamic)
  for (const video of videos) {
    const name = video.variantName?.trim()
    if (name) return name
  }

  return "campaña"
}

function buildABOAdgroups(
  dynamic: ABODynamicFields,
  context: ABODynamicCampaignContext
): ABOStrategyConfig["adgroups"] {
  const strategy = getTikTokStrategy("ABO")
  const selectedVideos = resolveEffectiveVideoCreatives(context, dynamic)

  if (selectedVideos.length === 0) {
    return []
  }

  const variantLabel = resolveVariantNameForAdgroups(dynamic, context)

  return selectedVideos.map((video, index) => ({
    name: strategy.buildAdgroupName(variantLabel, index),
    video: video.url,
    url: dynamic.landingPageUrl || undefined,
  }))
}

export function rebuildABOStrategyConfig(
  campaignName: string,
  dynamic: ABODynamicFields,
  context: ABODynamicCampaignContext,
  options?: { pixelId?: string }
): ABOStrategyConfig {
  const strategy = getTikTokStrategy("ABO")
  const normalizedDynamic = normalizeABODynamicFields(dynamic, context)
  const variantName = resolveVariantNameForAdgroups(normalizedDynamic, context)
  const dynamicWithVariant = { ...normalizedDynamic, variantName }
  const adgroups = buildABOAdgroups(dynamicWithVariant, context)

  return {
    strategy: "ABO",
    campaign: {
      ...strategy.staticDefaults.campaign,
      name: campaignName,
      daily_budget: normalizedDynamic.budgetPerAdgroup,
      ad_text: normalizedDynamic.adText,
      default_url: normalizedDynamic.landingPageUrl || undefined,
      pixel_id: options?.pixelId ?? strategy.staticDefaults.campaign.pixel_id,
    },
    ctas: strategy.staticDefaults.ctas,
    adgroups,
    landingPages: context.landingPages,
    creatives: context.creatives,
    dynamic: dynamicWithVariant,
  }
}

export function parseCampaignStrategyConfig(
  config: unknown
): CampaignStrategyConfig | null {
  if (!config || typeof config !== "object") return null

  const record = config as Record<string, unknown>
  const strategy = record.strategy

  if (typeof strategy !== "string" || !isTikTokStrategyId(strategy)) {
    return null
  }

  if (strategy === "ABO") {
    const abo = record as ABOStrategyConfig
    return {
      ...abo,
      landingPages: Array.isArray(abo.landingPages) ? abo.landingPages : [],
      creatives: Array.isArray(abo.creatives) ? abo.creatives : [],
    }
  }

  return null
}

export function toLaunchConfig(
  config: CampaignStrategyConfig
): Omit<CampaignStrategyConfig, "strategy" | "dynamic" | "landingPages" | "creatives"> {
  const {
    strategy: _strategy,
    dynamic: _dynamic,
    landingPages: _landingPages,
    creatives: _creatives,
    ...launchConfig
  } = config
  return launchConfig
}
