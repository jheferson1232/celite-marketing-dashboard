import { DASHBOARD_TIMEZONE } from "@/lib/date"
import { fetchAllPages } from "./fetch-all-pages"
import { getTikTokRequestContext } from "./tiktok-api.server"
import { clearTikTokCache } from "./tiktok-cache"
import type { TikTokAd, TikTokAdGroup } from "./types"

/**
 * Solo campos aceptados por /adgroup/get/.
 * Un nombre inválido en `fields` hace fallar toda la request (ej. fields.43 = is_comment_disable).
 */
const ADGROUP_GET_FIELDS = JSON.stringify([
  "adgroup_id",
  "adgroup_name",
  "campaign_id",
  "operation_status",
  "budget",
  "budget_mode",
  "campaign_automation_type",
  "promotion_type",
  "promotion_website_type",
  "pixel_id",
  "optimization_event",
  "optimization_goal",
  "billing_event",
  "bid_type",
  "bid_price",
  "conversion_bid_price",
  "deep_bid_type",
  "roas_bid",
  "placements",
  "placement_type",
  "location_ids",
  "gender",
  "age_groups",
  "languages",
  "interest_category_ids",
  "audience_ids",
  "excluded_audience_ids",
  "pacing",
  "schedule_type",
  "schedule_start_time",
  "schedule_end_time",
  "dayparting",
  "frequency",
  "frequency_schedule",
  "comment_disabled",
  "video_download_disabled",
  "secondary_optimization_event",
  "click_attribution_window",
  "engaged_view_attribution_window",
  "view_attribution_window",
  "attribution_event_count",
  "creative_material_mode",
  "catalog_id",
  "app_id",
  "messaging_app_account_id",
  "blocked_pangle_app_ids",
])

const AD_GET_FIELDS_FOR_DUPLICATE = JSON.stringify([
  "ad_id",
  "ad_name",
  "adgroup_id",
  "operation_status",
  "ad_format",
  "ad_text",
  "call_to_action",
  "landing_page_url",
  "landing_page_urls",
  "display_name",
  "identity_id",
  "identity_type",
  "video_id",
  "image_ids",
  "tiktok_item_id",
  "creative_authorized",
  "campaign_automation_type",
])

/** Campos creativos mínimos que sí suelen venir en /ad/get/. */
const AD_GET_FIELDS_CREATIVE_CORE = JSON.stringify([
  "ad_id",
  "ad_name",
  "adgroup_id",
  "operation_status",
  "ad_format",
  "landing_page_url",
  "landing_page_urls",
  "identity_id",
  "identity_type",
  "video_id",
  "image_ids",
  "tiktok_item_id",
  "creative_authorized",
  "ad_text",
  "call_to_action",
  "display_name",
])

const DEFAULT_CTA = "SHOP_NOW"
const DEFAULT_AD_TEXT = "."
const BASE_URL = "https://business-api.tiktok.com/open_api/v1.3"

/** Campos del conjunto que se pueden reenviar a /adgroup/create/. */
const ADGROUP_COPY_KEYS = [
  "campaign_id",
  "budget_mode",
  "budget",
  "promotion_type",
  "promotion_website_type",
  "pixel_id",
  "optimization_event",
  "optimization_goal",
  "billing_event",
  "bid_type",
  "bid_price",
  "conversion_bid_price",
  "deep_bid_type",
  "roas_bid",
  "placements",
  "placement_type",
  "location_ids",
  "gender",
  "age_groups",
  "languages",
  "interest_category_ids",
  "audience_ids",
  "excluded_audience_ids",
  "pacing",
  "schedule_type",
  "schedule_end_time",
  "dayparting",
  "frequency",
  "frequency_schedule",
  "comment_disabled",
  "video_download_disabled",
  "secondary_optimization_event",
  "click_attribution_window",
  "engaged_view_attribution_window",
  "view_attribution_window",
  "attribution_event_count",
  "creative_material_mode",
  "catalog_id",
  "app_id",
  "messaging_app_account_id",
  "blocked_pangle_app_ids",
] as const

type AdGroupSource = TikTokAdGroup & Record<string, unknown>

function formatScheduleStartNow(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: DASHBOARD_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date())

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00"

  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`
}

function truncateName(name: string, maxLen: number): string {
  if (name.length <= maxLen) return name
  return name.slice(0, maxLen)
}

/**
 * Genera un nombre único: «X (copia)», «X (copia 2)», …
 * TikTok rechaza duplicar si el nombre ya existe en la cuenta/campaña.
 */
function buildUniqueDuplicateAdgroupName(
  sourceName: string,
  existingNames: Set<string>
): string {
  const base = sourceName.trim() || "Conjunto"
  const maxLen = 100
  const normalizedExisting = new Set(
    [...existingNames].map((n) => n.trim().toLowerCase())
  )

  const candidates: string[] = []
  candidates.push(truncateName(`${base} (copia)`, maxLen))
  for (let i = 2; i <= 50; i++) {
    candidates.push(truncateName(`${base} (copia ${i})`, maxLen))
  }
  // Último recurso: timestamp corto
  const stamp = Date.now().toString(36).slice(-4)
  candidates.push(truncateName(`${base} (copia ${stamp})`, maxLen))

  for (const candidate of candidates) {
    if (!normalizedExisting.has(candidate.toLowerCase())) {
      return candidate
    }
  }

  return truncateName(`${base} ${Date.now()}`, maxLen)
}

function buildUniqueAdName(
  sourceAdName: string,
  index: number,
  stamp: string
): string {
  const base = (sourceAdName || "Anuncio").trim()
  return truncateName(`${base} (copia ${stamp}-${index + 1})`, 100)
}

function copyDefinedFields(
  source: AdGroupSource,
  keys: readonly string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of keys) {
    const value = source[key]
    if (value === undefined || value === null || value === "") continue
    if (Array.isArray(value) && value.length === 0) continue
    // Frecuencia 0 / bids 0 suelen ser “sin valor” y rompen create.
    if (typeof value === "number" && value <= 0 && key !== "budget") continue
    out[key] = value
  }
  return out
}

async function listAdGroupNamesInCampaign(
  campaignId: string
): Promise<Set<string>> {
  const groups = await fetchAllPages<TikTokAdGroup>("/adgroup/get/", {
    filtering: JSON.stringify({ campaign_ids: [campaignId] }),
    fields: JSON.stringify(["adgroup_id", "adgroup_name", "campaign_id"]),
  })
  return new Set(
    groups
      .map((g) => g.adgroup_name?.trim())
      .filter((n): n is string => Boolean(n))
  )
}

async function fetchAdGroupForDuplicate(
  adgroupId: string
): Promise<AdGroupSource> {
  try {
    const groups = await fetchAllPages<AdGroupSource>("/adgroup/get/", {
      filtering: JSON.stringify({ adgroup_ids: [adgroupId] }),
      fields: ADGROUP_GET_FIELDS,
    })
    const group = groups.find((g) => g.adgroup_id === adgroupId)
    if (!group) {
      throw new Error("No se encontró el conjunto en TikTok")
    }
    return group
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // Si la API rechaza algún field, reintentar sin `fields` (defaults de TikTok).
    if (!message.includes("fields.")) throw error

    const groups = await fetchAllPages<AdGroupSource>("/adgroup/get/", {
      filtering: JSON.stringify({ adgroup_ids: [adgroupId] }),
    })
    const group = groups.find((g) => g.adgroup_id === adgroupId)
    if (!group) {
      throw new Error("No se encontró el conjunto en TikTok")
    }
    return group
  }
}

async function fetchAdsForAdGroup(adgroupId: string): Promise<TikTokAd[]> {
  const filtering = JSON.stringify({
    adgroup_ids: [adgroupId],
    primary_status: "STATUS_NOT_DELETE",
  })

  try {
    return await fetchAllPages<TikTokAd>("/ad/get/", {
      filtering,
      fields: AD_GET_FIELDS_FOR_DUPLICATE,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes("fields.")) throw error
    return fetchAllPages<TikTokAd>("/ad/get/", {
      filtering,
      fields: AD_GET_FIELDS_CREATIVE_CORE,
    })
  }
}

function normalizeImageIds(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map(String).map((s) => s.trim()).filter(Boolean)
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        return parsed.map(String).map((s) => s.trim()).filter(Boolean)
      }
    } catch {
      return [raw.trim()]
    }
  }
  return []
}

function resolveLandingPageUrl(ad: TikTokAd): string | undefined {
  if (ad.landing_page_url?.trim()) return ad.landing_page_url.trim()
  const urls = ad.landing_page_urls as unknown
  if (!Array.isArray(urls) || urls.length === 0) return undefined
  const first = urls[0]
  if (typeof first === "string" && first.trim()) return first.trim()
  if (first && typeof first === "object") {
    const row = first as Record<string, unknown>
    const nested =
      (typeof row.landing_page_url === "string" && row.landing_page_url) ||
      (typeof row.url === "string" && row.url) ||
      ""
    return nested.trim() || undefined
  }
  return undefined
}

async function resolveCoverImageIdForVideo(
  videoId: string
): Promise<string | null> {
  const { client, advertiserId, accessToken } = await getTikTokRequestContext()

  const { data } = await client.get<{
    data?: { list?: Array<{ video_cover_url?: string; poster_url?: string }> }
  }>("/file/video/ad/info/", {
    params: {
      advertiser_id: advertiserId,
      video_ids: JSON.stringify([videoId]),
      fields: JSON.stringify(["video_id", "video_cover_url", "poster_url"]),
    },
  })

  const coverUrl =
    data.data?.list?.[0]?.video_cover_url?.trim() ||
    data.data?.list?.[0]?.poster_url?.trim() ||
    null
  if (!coverUrl) return null

  const imgRes = await fetch(coverUrl)
  if (!imgRes.ok) return null
  const imgBuf = Buffer.from(await imgRes.arrayBuffer())
  const crypto = await import("node:crypto")
  const md5 = crypto.createHash("md5").update(imgBuf).digest("hex")

  const fd = new FormData()
  fd.append("advertiser_id", advertiserId)
  fd.append("upload_type", "UPLOAD_BY_FILE")
  fd.append(
    "image_file",
    new Blob([new Uint8Array(imgBuf)], { type: "image/jpeg" }),
    `cover_${videoId}.jpg`
  )
  fd.append("image_signature", md5)

  const uploadRes = await fetch(`${BASE_URL}/file/image/ad/upload/`, {
    method: "POST",
    headers: { "Access-Token": accessToken },
    body: fd,
  })
  const json = (await uploadRes.json()) as {
    code?: number
    message?: string
    data?: { image_id?: string }
  }
  if (json.code !== 0 || !json.data?.image_id) {
    console.error("duplicate cover upload:", json.message ?? json)
    return null
  }
  return json.data.image_id
}

function isUnsupportedCustomIdentity(identityType: string): boolean {
  const t = identityType.trim().toUpperCase()
  return (
    t === "CUSTOMIZED_USER" ||
    t === "CUSTOM_IDENTITY" ||
    t === "CUSTOM" ||
    t.includes("CUSTOM")
  )
}

/**
 * TikTok ya no acepta identities “custom” en ad/create.
 * Preferir TT_USER de la cuenta conectada; si el anuncio trae AUTH_CODE/TT_USER, usarlo.
 */
function resolveIdentityForDuplicateAd(
  ad: TikTokAd,
  accountIdentityId: string | null
): { identityId: string; identityType: string } | null {
  const adType = ad.identity_type?.trim() || ""
  const adId = ad.identity_id?.trim() || ""

  // Cuenta configurada: siempre válida para videos de biblioteca.
  if (accountIdentityId?.trim()) {
    // Spark puede exigir la identity del post si no es custom.
    if (
      ad.tiktok_item_id?.trim() &&
      adId &&
      adType &&
      !isUnsupportedCustomIdentity(adType)
    ) {
      return { identityId: adId, identityType: adType }
    }
    return {
      identityId: accountIdentityId.trim(),
      identityType: "TT_USER",
    }
  }

  if (adId && adType && !isUnsupportedCustomIdentity(adType)) {
    return { identityId: adId, identityType: adType }
  }

  return null
}

async function buildAdCreativePayload(
  ad: TikTokAd,
  adName: string,
  accountIdentityId: string | null
): Promise<{ creative: Record<string, unknown> } | { skipReason: string }> {
  const landing = resolveLandingPageUrl(ad)
  const videoId = ad.video_id?.trim() || ""
  const sparkItemId = ad.tiktok_item_id?.trim() || ""
  let imageIds = normalizeImageIds(ad.image_ids)

  const identity = resolveIdentityForDuplicateAd(ad, accountIdentityId)

  const base: Record<string, unknown> = {
    ad_name: adName,
    ad_format: ad.ad_format || "SINGLE_VIDEO",
    operation_status: "DISABLE",
    ad_text: ad.ad_text?.trim() || DEFAULT_AD_TEXT,
    call_to_action: ad.call_to_action?.trim() || DEFAULT_CTA,
  }

  if (landing) base.landing_page_url = landing
  if (ad.display_name?.trim()) base.display_name = ad.display_name.trim()

  if (!identity) {
    return {
      skipReason: `Anuncio «${ad.ad_name}»: configurá Identity ID (TT_USER) en la cuenta TikTok Ads`,
    }
  }

  base.identity_id = identity.identityId
  base.identity_type = identity.identityType

  if (sparkItemId) {
    base.tiktok_item_id = sparkItemId
    base.creative_authorized =
      ad.creative_authorized != null ? ad.creative_authorized : true
    return { creative: base }
  }

  if (videoId) {
    if (imageIds.length === 0) {
      const coverId = await resolveCoverImageIdForVideo(videoId)
      if (coverId) imageIds = [coverId]
    }
    base.video_id = videoId
    if (imageIds.length > 0) base.image_ids = imageIds
    return { creative: base }
  }

  return {
    skipReason: `Anuncio «${ad.ad_name}»: sin video_id ni tiktok_item_id (no se pudo leer el creativo)`,
  }
}

function humanizeDuplicateError(message: string): string {
  const lower = message.toLowerCase()
  if (
    lower.includes("already exists") ||
    lower.includes("ad group name") ||
    lower.includes("nombre")
  ) {
    return "Ese nombre de conjunto ya existe. Probá de nuevo (se generará otro nombre)."
  }
  if (lower.includes("custom identities are no longer supported")) {
    return "TikTok ya no acepta identity custom. Usá el Identity ID (TT_USER) de la cuenta en Cuentas TikTok Ads."
  }
  return message
}

export type DuplicateTikTokAdGroupResult = {
  sourceAdgroupId: string
  newAdgroupId: string
  newAdgroupName: string
  adsCopied: number
  adsSkipped: number
  message: string
}

/**
 * Duplica un conjunto (y sus anuncios) en la misma campaña.
 * El nuevo conjunto queda en DISABLE.
 */
export async function duplicateTikTokAdGroup(
  adgroupId: string
): Promise<DuplicateTikTokAdGroupResult> {
  if (!adgroupId.trim()) {
    throw new Error("Falta el ID del conjunto")
  }

  const { client, advertiserId, identityId } = await getTikTokRequestContext()
  const source = await fetchAdGroupForDuplicate(adgroupId)

  if (source.campaign_automation_type === "UPGRADED_SMART_PLUS") {
    throw new Error(
      "Este conjunto es Smart+ actualizado; la API no permite duplicarlo desde el dashboard."
    )
  }

  const existingNames = await listAdGroupNamesInCampaign(source.campaign_id)
  const newAdgroupName = buildUniqueDuplicateAdgroupName(
    source.adgroup_name || "Conjunto",
    existingNames
  )

  const payload: Record<string, unknown> = {
    advertiser_id: advertiserId,
    adgroup_name: newAdgroupName,
    operation_status: "DISABLE",
    schedule_start_time: formatScheduleStartNow(),
    ...copyDefinedFields(source, ADGROUP_COPY_KEYS),
  }

  payload.campaign_id = source.campaign_id
  if (!payload.schedule_type) {
    payload.schedule_type = "SCHEDULE_FROM_NOW"
  }
  payload.schedule_start_time = formatScheduleStartNow()
  payload.adgroup_name = newAdgroupName

  let newAdgroupId: string
  try {
    const { data: createResponse } = await client.post<{
      data?: { adgroup_id?: string }
    }>("/adgroup/create/", payload)

    const id = createResponse.data?.adgroup_id
    if (!id) {
      throw new Error("No se pudo crear el conjunto duplicado en TikTok")
    }
    newAdgroupId = id
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error)
    throw new Error(humanizeDuplicateError(raw))
  }

  const ads = await fetchAdsForAdGroup(adgroupId)
  let adsCopied = 0
  let adsSkipped = 0
  const skipReasons: string[] = []
  const stamp = Date.now().toString(36).slice(-4)

  for (let i = 0; i < ads.length; i++) {
    const ad = ads[i]!
    const built = await buildAdCreativePayload(
      ad,
      buildUniqueAdName(ad.ad_name, i, stamp),
      identityId
    )

    if ("skipReason" in built) {
      adsSkipped += 1
      if (skipReasons.length < 3) skipReasons.push(built.skipReason)
      continue
    }

    try {
      const { data: adCreate } = await client.post<{
        data?: { ad_ids?: string[] }
      }>("/ad/create/", {
        advertiser_id: advertiserId,
        adgroup_id: newAdgroupId,
        creatives: [built.creative],
      })

      if (!adCreate.data?.ad_ids?.length) {
        adsSkipped += 1
        if (skipReasons.length < 3) {
          skipReasons.push(`Anuncio «${ad.ad_name}»: TikTok no devolvió ad_id`)
        }
        continue
      }
      adsCopied += 1
    } catch (error) {
      adsSkipped += 1
      const msg = error instanceof Error ? error.message : String(error)
      if (skipReasons.length < 3) {
        skipReasons.push(`Anuncio «${ad.ad_name}»: ${msg}`)
      }
      console.error("duplicate ad/create failed:", ad.ad_id, msg)
    }
  }

  clearTikTokCache()

  let adsPart = ""
  if (ads.length === 0) {
    adsPart = " · el conjunto original no tiene anuncios legibles"
  } else if (adsCopied > 0) {
    adsPart = ` · ${adsCopied} anuncio(s) copiado(s)`
    if (adsSkipped > 0) adsPart += `, ${adsSkipped} omitido(s)`
  } else {
    adsPart = ` · sin anuncios copiados`
    if (skipReasons[0]) adsPart += `: ${skipReasons[0]}`
  }

  return {
    sourceAdgroupId: adgroupId,
    newAdgroupId,
    newAdgroupName,
    adsCopied,
    adsSkipped,
    message: `Duplicado: «${newAdgroupName}» (apagado)${adsPart}`,
  }
}
