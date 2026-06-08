import { anthropic } from "@ai-sdk/anthropic"
import { generateObject } from "ai"
import { z } from "zod"
import { isAnthropicConfigured } from "./env"
import type {
  MetaCommentActionKind,
  MetaCommentClassification,
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
  replyText: z.string().max(150).optional(),
})

const SYSTEM_PROMPT = `Sos el moderador de comentarios en anuncios de Facebook para una marca de calzado en Colombia.
Clasificá cada comentario y decidí la acción:

- spam o troll → action "hide"
- pregunta real sobre producto, envío, tallas, precio, disponibilidad → action "reply" con respuesta breve en español (máx 150 caracteres, tono amable y directo)
- positive o neutral (elogios, emojis, "me gusta", comentarios inocuos) → action "skip"

Reglas:
- No inventes datos de producto ni precios concretos.
- Si es duda de talla/envío sin datos, invitá a escribir por DM o revisar la landing.
- replyText solo cuando action es "reply".`

function normalizeDecision(
  raw: z.infer<typeof decisionSchema>
): {
  classification: MetaCommentClassification
  action: MetaCommentActionKind
  replyText: string | null
} {
  let action = raw.action
  let replyText = raw.replyText?.trim() ?? null

  if (raw.classification === "spam" || raw.classification === "troll") {
    action = "hide"
    replyText = null
  } else if (raw.classification === "question") {
    action = "reply"
    if (!replyText) {
      replyText = "¡Hola! Te escribimos por DM con la info. 😊"
    }
  } else {
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

export async function classifyMetaComment(message: string): Promise<{
  classification: MetaCommentClassification
  action: MetaCommentActionKind
  replyText: string | null
}> {
  if (!isAnthropicConfigured()) {
    throw new Error("ANTHROPIC_API_KEY es requerida para clasificar comentarios")
  }

  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-20250514"),
    schema: decisionSchema,
    system: SYSTEM_PROMPT,
    prompt: `Comentario:\n"""${message}"""`,
    temperature: 0.2,
  })

  return normalizeDecision(object)
}
