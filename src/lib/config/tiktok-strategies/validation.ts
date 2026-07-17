import type {
  ABODynamicCreative,
  ABODynamicFields,
  CBODynamicFields,
  CampaignLandingPageRef,
} from "./types"
import { CBO_ADGROUP_PRESETS, CBO_DEFAULT_PRESET_IDS } from "./cbo"

export type { ABODynamicCreative } from "./types"

export type ABODynamicCampaignContext = {
  budget: number
  landingPages: CampaignLandingPageRef[]
  creatives: ABODynamicCreative[]
}

export type ABODynamicFieldErrors = Partial<
  Record<
    | "budgetPerAdgroup"
    | "selectedCreativeIds"
    | "selectedTikTokVideoIds"
    | "landingPageId"
    | "landingPageUrl"
    | "adText",
    string
  >
>

type LegacyDynamicFields = Partial<ABODynamicFields> & {
  selectedVideoIds?: string[]
}

function pickDefaultCreativeIds(context: ABODynamicCampaignContext): string[] {
  return context.creatives.map((creative) => creative.id)
}

export function normalizeABODynamicFields(
  raw: LegacyDynamicFields,
  context: ABODynamicCampaignContext
): ABODynamicFields {
  const legacyVideoIds = Array.isArray(raw.selectedVideoIds)
    ? raw.selectedVideoIds.filter((id): id is string => typeof id === "string")
    : []

  const autoCreateAdgroupsFromCreatives =
    typeof raw.autoCreateAdgroupsFromCreatives === "boolean"
      ? raw.autoCreateAdgroupsFromCreatives
      : legacyVideoIds.length === 0

  const selectedCreativeIds = Array.isArray(raw.selectedCreativeIds)
    ? raw.selectedCreativeIds.filter((id): id is string => typeof id === "string")
    : legacyVideoIds.length > 0
      ? legacyVideoIds
      : pickDefaultCreativeIds(context)

  const selectedTikTokVideoIds = Array.isArray(raw.selectedTikTokVideoIds)
    ? raw.selectedTikTokVideoIds.filter((id): id is string => typeof id === "string")
    : []

  const landingPageId =
    typeof raw.landingPageId === "string" || raw.landingPageId === null
      ? raw.landingPageId
      : context.landingPages[0]?.id ?? null

  const landingPageUrl =
    typeof raw.landingPageUrl === "string"
      ? raw.landingPageUrl
      : context.landingPages[0]?.url ?? ""

  const budgetPerAdgroup =
    typeof raw.budgetPerAdgroup === "number" && Number.isFinite(raw.budgetPerAdgroup)
      ? raw.budgetPerAdgroup
      : context.budget > 0
        ? context.budget
        : 0

  const adText =
    typeof raw.adText === "string" && raw.adText.trim().length > 0
      ? raw.adText.trim()
      : "Consigue los tuyos ahora 🔥 Envío gratis"

  return {
    variantId: typeof raw.variantId === "string" ? raw.variantId.trim() : "",
    variantName: typeof raw.variantName === "string" ? raw.variantName.trim() : "",
    budgetPerAdgroup,
    autoCreateAdgroupsFromCreatives,
    selectedCreativeIds,
    selectedTikTokVideoIds,
    landingPageId,
    landingPageUrl,
    adText,
  }
}

export function resolveEffectiveCreativeIds(
  context: ABODynamicCampaignContext,
  dynamic: ABODynamicFields
): string[] {
  if (dynamic.autoCreateAdgroupsFromCreatives) {
    return context.creatives.map((creative) => creative.id)
  }

  const allowedIds = new Set(context.creatives.map((creative) => creative.id))
  return dynamic.selectedCreativeIds.filter((id) => allowedIds.has(id))
}

export function resolveEffectiveVideoCreatives(
  context: ABODynamicCampaignContext,
  dynamic: ABODynamicFields
) {
  const effectiveIds = new Set(resolveEffectiveCreativeIds(context, dynamic))
  return context.creatives.filter(
    (creative) => effectiveIds.has(creative.id) && creative.type === "video"
  )
}

export function validateABODynamicFields(
  dynamic: ABODynamicFields,
  context: ABODynamicCampaignContext
): { valid: boolean; errors: ABODynamicFieldErrors } {
  const errors: ABODynamicFieldErrors = {}

  if (!Number.isFinite(dynamic.budgetPerAdgroup) || dynamic.budgetPerAdgroup <= 0) {
    errors.budgetPerAdgroup = "El presupuesto debe ser mayor a 0"
  }

  if (!dynamic.landingPageUrl.trim()) {
    errors.landingPageUrl = "Selecciona una landing page"
  }

  if (!dynamic.adText.trim()) {
    errors.adText = "El texto del anuncio es obligatorio"
  }

  const effectiveCreatives = resolveEffectiveCreativeIds(context, dynamic)
  const tikTokVideoCount = dynamic.selectedTikTokVideoIds.length
  const effectiveVideos = resolveEffectiveVideoCreatives(context, dynamic)

  if (
    !dynamic.autoCreateAdgroupsFromCreatives &&
    effectiveCreatives.length === 0 &&
    tikTokVideoCount === 0
  ) {
    errors.selectedCreativeIds =
      "Selecciona al menos un creativo del Baúl o de la cuenta TikTok"
  }

  if (effectiveVideos.length === 0 && tikTokVideoCount === 0) {
    errors.selectedCreativeIds =
      "Se requiere al menos un video (Baúl o biblioteca TikTok) para crear conjuntos"
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  }
}

export type CBODynamicCampaignContext = ABODynamicCampaignContext

export type CBODynamicFieldErrors = Partial<
  Record<
    | "campaignBudget"
    | "selectedPresetIds"
    | "selectedCreativeIds"
    | "selectedTikTokVideoIds"
    | "landingPageId"
    | "landingPageUrl"
    | "adText",
    string
  >
>

export function normalizeCBODynamicFields(
  raw: Partial<CBODynamicFields> & {
    /** Legacy single-video fields. */
    selectedCreativeId?: string | null
    selectedTikTokVideoId?: string | null
  },
  context: CBODynamicCampaignContext
): CBODynamicFields {
  const landingPageId =
    typeof raw.landingPageId === "string" || raw.landingPageId === null
      ? raw.landingPageId
      : context.landingPages[0]?.id ?? null

  const landingPageUrl =
    typeof raw.landingPageUrl === "string"
      ? raw.landingPageUrl
      : context.landingPages[0]?.url ?? ""

  const campaignBudget =
    typeof raw.campaignBudget === "number" && Number.isFinite(raw.campaignBudget)
      ? raw.campaignBudget
      : context.budget > 0
        ? context.budget
        : 0

  const selectedPresetIds = Array.isArray(raw.selectedPresetIds)
    ? raw.selectedPresetIds.filter((id): id is string => typeof id === "string")
    : [...CBO_DEFAULT_PRESET_IDS]

  const selectedCreativeIds = Array.isArray(raw.selectedCreativeIds)
    ? raw.selectedCreativeIds.filter((id): id is string => typeof id === "string")
    : typeof raw.selectedCreativeId === "string" && raw.selectedCreativeId
      ? [raw.selectedCreativeId]
      : []

  const selectedTikTokVideoIds = Array.isArray(raw.selectedTikTokVideoIds)
    ? raw.selectedTikTokVideoIds.filter(
        (id): id is string => typeof id === "string" && id.trim().length > 0
      )
    : typeof raw.selectedTikTokVideoId === "string" &&
        raw.selectedTikTokVideoId.trim()
      ? [raw.selectedTikTokVideoId.trim()]
      : []

  const adText =
    typeof raw.adText === "string" && raw.adText.trim().length > 0
      ? raw.adText.trim()
      : "Consigue los tuyos ahora 🔥 Envío gratis"

  return {
    variantId: typeof raw.variantId === "string" ? raw.variantId.trim() : "",
    variantName: typeof raw.variantName === "string" ? raw.variantName.trim() : "",
    campaignBudget,
    selectedPresetIds,
    selectedCreativeIds,
    selectedTikTokVideoIds,
    landingPageId,
    landingPageUrl,
    adText,
  }
}

export function validateCBODynamicFields(
  dynamic: CBODynamicFields,
  context: CBODynamicCampaignContext
): { valid: boolean; errors: CBODynamicFieldErrors } {
  const errors: CBODynamicFieldErrors = {}
  if (!Number.isFinite(dynamic.campaignBudget) || dynamic.campaignBudget <= 0) {
    errors.campaignBudget = "El presupuesto de campaña debe ser mayor a 0"
  }

  if (!dynamic.landingPageUrl.trim()) {
    errors.landingPageUrl = "Selecciona una landing page"
  }

  if (!dynamic.adText.trim()) {
    errors.adText = "El texto del anuncio es obligatorio"
  }

  const allowedPresets = new Set(
    CBO_ADGROUP_PRESETS.map((preset) => preset.id)
  )
  const effectivePresets = dynamic.selectedPresetIds.filter((id) =>
    allowedPresets.has(id as (typeof CBO_ADGROUP_PRESETS)[number]["id"])
  )

  if (effectivePresets.length === 0) {
    errors.selectedPresetIds = "Selecciona al menos un conjunto de intereses"
  }

  const allowedCreativeIds = new Set(context.creatives.map((c) => c.id))
  const baulIds = dynamic.selectedCreativeIds.filter((id) =>
    allowedCreativeIds.has(id)
  )
  const tikTokIds = dynamic.selectedTikTokVideoIds.filter((id) => id.trim())

  if (baulIds.length === 0 && tikTokIds.length === 0) {
    errors.selectedCreativeIds =
      "Selecciona al menos un video (Baúl o biblioteca TikTok)"
  }

  if (baulIds.length > 0 && tikTokIds.length > 0) {
    errors.selectedTikTokVideoIds =
      "CBO usa Baúl o TikTok, no ambos a la vez"
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  }
}
