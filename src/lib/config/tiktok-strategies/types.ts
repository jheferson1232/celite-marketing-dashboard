import type { TikTokLaunchCampaignConfig } from "@/lib/services/tiktok/launch-campaign-types"

export const TIKTOK_STRATEGY_IDS = ["ABO"] as const

export type TikTokStrategyId = (typeof TIKTOK_STRATEGY_IDS)[number]

export type ABODynamicFields = {
  variantId: string
  variantName: string
  budgetPerAdgroup: number
  autoCreateAdgroupsFromCreatives: boolean
  selectedCreativeIds: string[]
  /** Videos ya subidos a la biblioteca de la cuenta TikTok Ads. */
  selectedTikTokVideoIds: string[]
  landingPageId: string | null
  landingPageUrl: string
  adText: string
}

export type ABODynamicCreative = {
  id: string
  url: string
  type: "image" | "video"
  name: string | null
  variantName?: string | null
}

export type CampaignLandingPageRef = {
  id: string
  url: string
}

export type ABOStrategyConfig = TikTokLaunchCampaignConfig & {
  strategy: "ABO"
  dynamic: ABODynamicFields
  landingPages: CampaignLandingPageRef[]
  creatives: ABODynamicCreative[]
}

export type CampaignStrategyConfig = ABOStrategyConfig

export type TikTokStrategyDefinition = {
  id: TikTokStrategyId
  label: string
  description: string
  staticDefaults: Omit<TikTokLaunchCampaignConfig, "adgroups"> & {
    adTextDefault: string
  }
  buildCampaignName: (productName: string) => string
  buildAdgroupName: (variantName: string, index: number) => string
}
