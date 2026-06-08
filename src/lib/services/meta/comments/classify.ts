import { anthropic } from "@ai-sdk/anthropic"
import { generateObject } from "ai"
import { z } from "zod"
import type { MetaCommentAgentSettingsRecord } from "./agent-settings"
import { isAnthropicConfigured } from "./env"
import type { MetaCommentProductRecord } from "./products"
import type {
  MetaCommentActionKind,
  MetaCommentClassification,
  MetaCommentReplyMode,
} from "./types"

const decisionSchema = z.object({
  classification: z.enum([
    "spam",
    "troll",
    "question",
    "positive",
    "neutral",
  ]),
  action: z.enum(["hide", "reply", "skip"]),
  replyText: z.string().max(300).optional(),
})

export type MetaCommentClassifyContext = {
  replyMode?: MetaCommentReplyMode
  replyTemplate?: string | null
  websiteUrl?: string | null
  pageName?: string | null
  agentSettings?: MetaCommentAgentSettingsRecord | null
  products?: MetaCommentProductRecord[]
}

function buildBusinessBlock(settings: MetaCommentAgentSettingsRecord): string {
  const lines: string[] = []
  if (settings.contactInfo?.trim()) {
    lines.push(`Contacto: ${settings.contactInfo.trim()}`)
  }
  if (settings.shippingTime?.trim()) {
    lines.push(`Tiempo de envío: ${settings.shippingTime.trim()}`)
  }
  if (settings.businessInfo?.trim()) {
    lines.push(`Info del negocio: ${settings.businessInfo.trim()}`)
  }
  return lines.length ? `Información del negocio:\n${lines.join("\n")}` : ""
}

function buildProductsBlock(products: MetaCommentProductRecord[]): string {
  if (!products.length) return ""
  const items = products.map(
    (p, i) =>
      `${i + 1}. ${p.name}: ${p.description}${p.tags.length ? ` (tags: ${p.tags.join(", ")})` : ""}`
  )
  return `Productos/comentarios activos:\n${items.join("\n")}`
}

function buildSystemPrompt(context?: MetaCommentClassifyContext): string {
  const settings = context?.agentSettings
  const products = context?.products ?? []

  if (settings) {
    const parts: string[] = []

    const business = buildBusinessBlock(settings)
    if (business) parts.push(business)

    const catalog = buildProductsBlock(products)
    if (catalog) parts.push(catalog)

    if (settings.deleteNegativeEnabled && settings.deletePrompt?.trim()) {
      parts.push(`Moderación de comentarios negativos:\n${settings.deletePrompt.trim()}`)
      if (settings.deleteExamplesRemove?.trim()) {
        parts.push(
          `Ejemplos de comentarios a eliminar:\n${settings.deleteExamplesRemove.trim()}`
        )
      }
      if (settings.deleteExamplesKeep?.trim()) {
        parts.push(
          `Ejemplos que NO se deben eliminar:\n${settings.deleteExamplesKeep.trim()}`
        )
      }
    }

    if (settings.publicReplyEnabled && settings.publicReplyPrompt?.trim()) {
      parts.push(`Respuesta pública:\n${settings.publicReplyPrompt.trim()}`)
      const auth: string[] = []
      if (settings.publicReplyIncludeLink) {
        auth.push("podés incluir enlace si hay URL disponible")
      } else {
        auth.push("no incluyas enlaces")
      }
      if (settings.publicReplyIncludePrice) {
        auth.push("podés mencionar precio si está en la descripción del producto")
      } else {
        auth.push("no menciones precios")
      }
      parts.push(`Autorizaciones de respuesta: ${auth.join("; ")}.`)
    }

    if (context?.pageName) {
      parts.push(`Página: ${context.pageName}.`)
    }
    if (context?.websiteUrl?.trim()) {
      parts.push(`Sitio web: ${context.websiteUrl.trim()}`)
    }
    if (context?.replyTemplate?.trim()) {
      parts.push(`Plantilla guía: ${context.replyTemplate.trim()}`)
    }

    const modeHint =
      context?.replyMode === "friendly"
        ? "Tono cercano y cálido."
        : context?.replyMode === "concise"
          ? "Tono muy breve y directo."
          : "Tono profesional y amable."
    parts.push(modeHint)

    parts.push(`Clasificá cada comentario y decidí la acción:
- spam, troll o comentario negativo según las reglas de moderación → action "hide"
- pregunta real sobre producto, envío, tallas, precio, disponibilidad → action "reply" con respuesta breve en español (máx 150 caracteres)
- positive o neutral (elogios, emojis, comentarios inocuos) → action "skip"

Reglas:
- No inventes datos que no estén en la información del negocio o productos.
- replyText solo cuando action es "reply".`)

    if (!settings.deleteNegativeEnabled) {
      parts.push('No uses action "hide" (eliminación de negativos desactivada).')
    }
    if (!settings.publicReplyEnabled) {
      parts.push('No uses action "reply" (respuesta pública desactivada).')
    }

    return parts.join("\n\n")
  }

  const modeHint =
    context?.replyMode === "friendly"
      ? "Tono cercano y cálido."
      : context?.replyMode === "concise"
        ? "Respuestas muy breves y directas."
        : "Tono profesional y amable."

  const extra: string[] = [modeHint]
  if (context?.pageName) extra.push(`Página: ${context.pageName}.`)
  if (context?.websiteUrl) {
    extra.push(`Podés invitar a visitar: ${context.websiteUrl}`)
  }
  if (context?.replyTemplate?.trim()) {
    extra.push(`Plantilla guía: ${context.replyTemplate.trim()}`)
  }

  return `Sos el moderador de comentarios en anuncios de Facebook para una marca de calzado en Colombia.
${extra.join("\n")}
Clasificá cada comentario y decidí la acción:

- spam o troll → action "hide"
- pregunta real sobre producto, envío, tallas, precio, disponibilidad → action "reply" con respuesta breve en español (máx 150 caracteres, tono amable y directo)
- positive o neutral (elogios, emojis, "me gusta", comentarios inocuos) → action "skip"

Reglas:
- No inventes datos de producto ni precios concretos.
- Si es duda de talla/envío sin datos, invitá a escribir por DM o revisar la landing.
- replyText solo cuando action es "reply".`
}

function normalizeDecision(
  raw: z.infer<typeof decisionSchema>,
  context?: MetaCommentClassifyContext
): {
  classification: MetaCommentClassification
  action: MetaCommentActionKind
  replyText: string | null
} {
  let action = raw.action
  let replyText = raw.replyText?.trim() ?? null
  const settings = context?.agentSettings

  if (raw.classification === "spam" || raw.classification === "troll") {
    action = "hide"
    replyText = null
  } else if (raw.classification === "question") {
    action = "reply"
    if (!replyText) {
      replyText = "¡Hola! Te escribimos por DM con la info."
    }
  } else {
    action = "skip"
    replyText = null
  }

  if (settings && !settings.deleteNegativeEnabled && action === "hide") {
    action = "skip"
    replyText = null
  }

  if (settings && !settings.publicReplyEnabled && action === "reply") {
    action = "skip"
    replyText = null
  }

  if (action === "reply" && replyText && replyText.length > 150) {
    replyText = replyText.slice(0, 150)
  }

  return {
    classification: raw.classification,
    action,
    replyText,
  }
}

export async function classifyMetaComment(
  message: string,
  context?: MetaCommentClassifyContext
): Promise<{
  classification: MetaCommentClassification
  action: MetaCommentActionKind
  replyText: string | null
}> {
  if (!isAnthropicConfigured()) {
    throw new Error("ANTHROPIC_API_KEY es requerida para clasificar comentarios")
  }

  const system = buildSystemPrompt(context)

  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-6"),
    schema: decisionSchema,
    system,
    prompt: `Comentario:\n"""${message}"""`,
    temperature: 0.2,
  })

  return normalizeDecision(object, context)
}
