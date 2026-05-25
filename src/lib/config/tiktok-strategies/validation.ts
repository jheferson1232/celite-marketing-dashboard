import type { ABODynamicCreative, ABODynamicFields, CampaignLandingPageRef } from "./types"

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
  if (!dynamic.autoCreateAdgroupsFromCreatives && effectiveCreatives.length === 0) {
    errors.selectedCreativeIds = "Selecciona al menos un creativo"
  }

  const effectiveVideos = resolveEffectiveVideoCreatives(context, dynamic)
  if (effectiveVideos.length === 0) {
    errors.selectedCreativeIds =
      "Se requiere al menos un video para crear conjuntos en TikTok"
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  }
}
