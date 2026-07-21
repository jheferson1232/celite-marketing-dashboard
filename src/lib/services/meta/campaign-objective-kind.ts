/** Clasificación de campañas Meta por objetivo (ODAX + legacy). */

export type MetaCampaignObjectiveKind = "conversions" | "messages" | "other"

const CONVERSION_OBJECTIVES = new Set([
  "OUTCOME_SALES",
  "CONVERSIONS",
  "PRODUCT_CATALOG_SALES",
  "WEBSITE_CONVERSIONS",
])

const MESSAGE_OBJECTIVES = new Set([
  "MESSAGES",
  /** ODAX: engagement suele usarse para conversaciones / WhatsApp / Messenger. */
  "OUTCOME_ENGAGEMENT",
])

const NAME_MESSAGES_RE =
  /\b(msg|mensaje|mensajes|whatsapp|wsp|wa\b|messenger|chat|inbox|dm)\b/i
const NAME_CONVERSIONS_RE =
  /\b(conv|conversi[oó]n|venta|ventas|sales|compra|compras|shop|catalogo|cat[aá]logo|cbo|abo)\b/i

export function getMetaCampaignObjectiveKind(
  objective: string | undefined | null,
  name?: string | null
): MetaCampaignObjectiveKind {
  const normalized = (objective ?? "").trim().toUpperCase()
  if (normalized && CONVERSION_OBJECTIVES.has(normalized)) return "conversions"
  if (normalized && MESSAGE_OBJECTIVES.has(normalized)) return "messages"

  const campaignName = name?.trim() ?? ""
  if (campaignName) {
    if (NAME_MESSAGES_RE.test(campaignName)) return "messages"
    if (NAME_CONVERSIONS_RE.test(campaignName)) return "conversions"
  }

  return "other"
}

export function isMetaCampaignObjectiveKind(
  objective: string | undefined | null,
  kind: "conversions" | "messages",
  name?: string | null
): boolean {
  return getMetaCampaignObjectiveKind(objective, name) === kind
}
