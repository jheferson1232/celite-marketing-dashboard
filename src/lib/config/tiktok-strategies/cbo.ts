import type { TikTokStrategyDefinition } from "./types"

export const CBO_ADGROUP_PRESETS = [
  { id: "libre", name: "Libre", interestCategoryIds: [] as string[] },
  {
    id: "ropa",
    name: "Ropa y accesorios",
    interestCategoryIds: ["22"],
  },
  {
    id: "belleza",
    name: "Belleza y cuidado personal",
    interestCategoryIds: ["14"],
  },
] as const

export type CboAdgroupPresetId = (typeof CBO_ADGROUP_PRESETS)[number]["id"]

export const CBO_DEFAULT_PRESET_IDS: CboAdgroupPresetId[] = CBO_ADGROUP_PRESETS.map(
  (preset) => preset.id
)

export const CBO_STRATEGY: TikTokStrategyDefinition = {
  id: "CBO",
  label: "CBO",
  description:
    "Presupuesto a nivel de campaña. Cada video × 3 conjuntos (Libre, Ropa y accesorios, Belleza y cuidado personal).",
  staticDefaults: {
    campaign: {
      name: "",
      objective: "WEB_CONVERSIONS",
      daily_budget: 0,
      budget_scope: "campaign",
      pixel_id: "7558647730210488328",
      optimization_event: "SHOPPING",
      location_ids: ["3686110"],
      age_groups: [
        "AGE_18_24",
        "AGE_25_34",
        "AGE_35_44",
        "AGE_45_54",
        "AGE_55_100",
      ],
      gender: "GENDER_UNLIMITED",
      utm: {
        utm_source: "tiktok",
        utm_id: "__CAMPAIGN_ID__",
        utm_campaign: "__CAMPAIGN_NAME__",
        utm_medium: "paid",
      },
    },
    ctas: ["SHOP_NOW", "ORDER_NOW", "LEARN_MORE"],
    adTextDefault: "Consigue los tuyos ahora 🔥 Envío gratis",
  },
  buildCampaignName: (productName) => `${productName} cbo`,
  buildAdgroupName: (presetName) => presetName.toLowerCase(),
}
