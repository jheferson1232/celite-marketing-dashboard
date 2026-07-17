import {
  CBO_ADGROUP_PRESETS,
  getTikTokStrategy,
  isTikTokStrategyId,
  normalizeABODynamicFields,
  normalizeCBODynamicFields,
  resolveEffectiveVideoCreatives,
  type ABODynamicCampaignContext,
  type ABODynamicFields,
  type ABOStrategyConfig,
  type CBODynamicCampaignContext,
  type CBODynamicFields,
  type CBOStrategyConfig,
  type CampaignStrategyConfig,
  type TikTokStrategyId,
} from "@/lib/config/tiktok-strategies"
import { parseSparkVideoSelectionId } from "@/lib/services/tiktok/ad-video-asset"

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
      selectedTikTokVideoIds: [],
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
  const variantLabel = resolveVariantNameForAdgroups(dynamic, context)
  const landingUrl = dynamic.landingPageUrl || undefined

  const fromBaul = selectedVideos.map((video, index) => ({
    name: strategy.buildAdgroupName(variantLabel, index),
    video: video.url,
    url: landingUrl,
  }))

  const fromTikTok = dynamic.selectedTikTokVideoIds.map((videoId, index) => {
    const sparkItemId = parseSparkVideoSelectionId(videoId)
    return {
      name: strategy.buildAdgroupName(
        variantLabel,
        selectedVideos.length + index
      ),
      ...(sparkItemId
        ? { tiktok_item_id: sparkItemId, video_id: videoId }
        : { video_id: videoId }),
      url: landingUrl,
    }
  })

  return [...fromBaul, ...fromTikTok]
}

export function getCBODynamicCampaignContext(
  config: CBOStrategyConfig
): CBODynamicCampaignContext {
  return {
    budget: 0,
    landingPages: config.landingPages ?? [],
    creatives: config.creatives ?? [],
  }
}

export function buildEmptyCBOStrategyConfig(campaignName: string): CBOStrategyConfig {
  const strategy = getTikTokStrategy("CBO")

  return {
    strategy: "CBO",
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
      campaignBudget: 0,
      selectedPresetIds: CBO_ADGROUP_PRESETS.map((preset) => preset.id),
      selectedCreativeIds: [],
      selectedTikTokVideoIds: [],
      landingPageId: null,
      landingPageUrl: "",
      adText: strategy.staticDefaults.adTextDefault,
    },
  }
}

type CboCreativeRef = Pick<
  CBOStrategyConfig["adgroups"][number],
  "video" | "video_id" | "tiktok_item_id"
>

function resolveCboCreativeRefs(
  dynamic: CBODynamicFields,
  context: CBODynamicCampaignContext
): CboCreativeRef[] {
  if (dynamic.selectedTikTokVideoIds.length > 0) {
    return dynamic.selectedTikTokVideoIds.map((videoId) => {
      const sparkItemId = parseSparkVideoSelectionId(videoId)
      return sparkItemId
        ? { tiktok_item_id: sparkItemId, video_id: videoId }
        : { video_id: videoId }
    })
  }

  const byId = new Map(context.creatives.map((row) => [row.id, row]))
  return dynamic.selectedCreativeIds.flatMap((id) => {
    const creative = byId.get(id)
    return creative ? [{ video: creative.url }] : []
  })
}

function buildCBOAdgroups(
  dynamic: CBODynamicFields,
  context: CBODynamicCampaignContext
): CBOStrategyConfig["adgroups"] {
  const strategy = getTikTokStrategy("CBO")
  const creatives = resolveCboCreativeRefs(dynamic, context)
  const landingUrl = dynamic.landingPageUrl || undefined
  const allowedPresets = new Set(CBO_ADGROUP_PRESETS.map((preset) => preset.id))
  const presets = dynamic.selectedPresetIds
    .map((presetId) => CBO_ADGROUP_PRESETS.find((row) => row.id === presetId))
    .filter(
      (preset): preset is (typeof CBO_ADGROUP_PRESETS)[number] =>
        preset != null && allowedPresets.has(preset.id)
    )

  const adgroups: CBOStrategyConfig["adgroups"] = []
  creatives.forEach((creative, videoIndex) => {
    for (const preset of presets) {
      const baseName = strategy.buildAdgroupName(preset.name, videoIndex)
      const name =
        creatives.length > 1 ? `${baseName} ${videoIndex + 1}` : baseName
      adgroups.push({
        name,
        ...creative,
        url: landingUrl,
        interest_category_ids:
          preset.interestCategoryIds.length > 0
            ? [...preset.interestCategoryIds]
            : undefined,
      })
    }
  })

  return adgroups
}

export function rebuildCBOStrategyConfig(
  campaignName: string,
  dynamic: CBODynamicFields,
  context: CBODynamicCampaignContext,
  options?: { pixelId?: string; authCode?: string }
): CBOStrategyConfig {
  const strategy = getTikTokStrategy("CBO")
  const normalizedDynamic = normalizeCBODynamicFields(dynamic, context)
  const adgroups = buildCBOAdgroups(normalizedDynamic, context)
  const authCode = options?.authCode?.trim()

  return {
    strategy: "CBO",
    campaign: {
      ...strategy.staticDefaults.campaign,
      name: campaignName,
      daily_budget: normalizedDynamic.campaignBudget,
      budget_scope: "campaign",
      ad_text: normalizedDynamic.adText,
      default_url: normalizedDynamic.landingPageUrl || undefined,
      pixel_id: options?.pixelId ?? strategy.staticDefaults.campaign.pixel_id,
      ...(authCode ? { auth_code: authCode } : {}),
    },
    ctas: strategy.staticDefaults.ctas,
    adgroups,
    landingPages: context.landingPages,
    creatives: context.creatives,
    dynamic: normalizedDynamic,
  }
}

export function rebuildABOStrategyConfig(
  campaignName: string,
  dynamic: ABODynamicFields,
  context: ABODynamicCampaignContext,
  options?: { pixelId?: string; authCode?: string }
): ABOStrategyConfig {
  const strategy = getTikTokStrategy("ABO")
  const normalizedDynamic = normalizeABODynamicFields(dynamic, context)
  const variantName = resolveVariantNameForAdgroups(normalizedDynamic, context)
  const dynamicWithVariant = { ...normalizedDynamic, variantName }
  const adgroups = buildABOAdgroups(dynamicWithVariant, context)
  const authCode = options?.authCode?.trim()

  return {
    strategy: "ABO",
    campaign: {
      ...strategy.staticDefaults.campaign,
      name: campaignName,
      daily_budget: normalizedDynamic.budgetPerAdgroup,
      budget_scope: "adgroup",
      ad_text: normalizedDynamic.adText,
      default_url: normalizedDynamic.landingPageUrl || undefined,
      pixel_id: options?.pixelId ?? strategy.staticDefaults.campaign.pixel_id,
      ...(authCode ? { auth_code: authCode } : {}),
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

  if (strategy === "CBO") {
    const cbo = record as CBOStrategyConfig
    return {
      ...cbo,
      landingPages: Array.isArray(cbo.landingPages) ? cbo.landingPages : [],
      creatives: Array.isArray(cbo.creatives) ? cbo.creatives : [],
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
