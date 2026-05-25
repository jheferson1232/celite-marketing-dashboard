import assert from "node:assert/strict"
import {
  rebuildABOStrategyConfig,
} from "../src/lib/services/campaign-strategy-builder"
import type { ABODynamicCampaignContext } from "../src/lib/config/tiktok-strategies/validation"
import {
  normalizeABODynamicFields,
  validateABODynamicFields,
} from "../src/lib/config/tiktok-strategies/validation"

const context: ABODynamicCampaignContext = {
  budget: 0,
  landingPages: [
    {
      id: "lp-1",
      url: "https://example.com/landing",
    },
  ],
  creatives: [
    {
      id: "cr-video-1",
      url: "https://cdn.example.com/v1.mp4",
      type: "video",
      name: "Video 1",
      variantName: "Lokal Big",
    },
    {
      id: "cr-image-1",
      url: "https://cdn.example.com/i1.jpg",
      type: "image",
      name: "Imagen 1",
    },
  ],
}

const autoDynamic = normalizeABODynamicFields(
  {
    budgetPerAdgroup: 30000,
    autoCreateAdgroupsFromCreatives: true,
    selectedCreativeIds: [],
    landingPageId: "lp-1",
    landingPageUrl: "https://example.com/landing",
    adText: "Compra ahora",
  },
  context
)

const autoValidation = validateABODynamicFields(autoDynamic, context)
assert.equal(autoValidation.valid, true)

const autoConfig = rebuildABOStrategyConfig(
  "Campaña Test abo-auto",
  autoDynamic,
  context
)
assert.equal(autoConfig.adgroups.length, 1)
assert.equal(autoConfig.adgroups[0]?.name, "lokal big 1")
assert.equal(autoConfig.adgroups[0]?.video, "https://cdn.example.com/v1.mp4")

const manualDynamic = normalizeABODynamicFields(
  {
    budgetPerAdgroup: 30000,
    autoCreateAdgroupsFromCreatives: false,
    selectedCreativeIds: ["cr-video-1"],
    landingPageId: "lp-1",
    landingPageUrl: "https://example.com/landing",
    adText: "Compra ahora",
  },
  context
)

const manualConfig = rebuildABOStrategyConfig(
  "Nombre manual",
  manualDynamic,
  context
)
assert.equal(manualConfig.campaign.name, "Nombre manual")
assert.equal(manualConfig.adgroups.length, 1)

const legacyDynamic = normalizeABODynamicFields(
  {
    selectedVideoIds: ["cr-video-1"],
    budgetPerAdgroup: 10000,
    landingPageUrl: "https://example.com/landing",
    adText: "Legacy",
  },
  context
)
assert.equal(legacyDynamic.autoCreateAdgroupsFromCreatives, false)
assert.deepEqual(legacyDynamic.selectedCreativeIds, ["cr-video-1"])

const invalidDynamic = normalizeABODynamicFields(
  {
    budgetPerAdgroup: 0,
    autoCreateAdgroupsFromCreatives: true,
    selectedCreativeIds: [],
    landingPageId: null,
    landingPageUrl: "",
    adText: "",
  },
  context
)
const invalidValidation = validateABODynamicFields(invalidDynamic, context)
assert.equal(invalidValidation.valid, false)

console.log("ABO strategy QA checks passed")
