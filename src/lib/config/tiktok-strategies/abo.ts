import type { TikTokStrategyDefinition } from "./types"

export const ABO_STRATEGY: TikTokStrategyDefinition = {
  id: "ABO",
  label: "ABO",
  description:
    "Campaña con presupuesto a nivel de conjunto. Nombre: producto + abo-auto.",
  staticDefaults: {
    campaign: {
      name: "",
      objective: "WEB_CONVERSIONS",
      daily_budget: 0,
      pixel_id: "7558647730210488328",
      optimization_event: "ON_WEB_ORDER",
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
  buildCampaignName: (productName) => `${productName} abo-auto`,
  buildAdgroupName: (variantName, index) =>
    `${variantName} ${index + 1}`.toLowerCase(),
}
