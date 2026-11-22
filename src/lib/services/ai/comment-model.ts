/**
 * Modelo del agente de comentarios TikTok, servido por Vercel AI Gateway
 * (Meta sigue con Claude vía ANTHROPIC_API_KEY).
 * El SDK `ai` enruta los ids `proveedor/modelo` por el Gateway y se autentica con
 * `AI_GATEWAY_API_KEY` (API key creada en Vercel → AI Gateway → API Keys).
 */
/**
 * Gemini 2.5 Flash entra en el plan gratuito del Gateway; Gemini 3.x exige
 * crédito cargado. Para cambiarlo sin tocar código: TIKTOK_COMMENT_AI_MODEL
 * (p. ej. `google/gemini-3.5-flash-lite`).
 */
const DEFAULT_COMMENT_AGENT_MODEL = "google/gemini-2.5-flash"

export function getCommentAgentModel(): string {
  return process.env.TIKTOK_COMMENT_AI_MODEL?.trim() || DEFAULT_COMMENT_AGENT_MODEL
}

/** «google/gemini-2.5-flash» → «Gemini 2.5 Flash». */
export function getCommentAgentModelLabel(): string {
  const id = getCommentAgentModel().split("/").pop() ?? ""
  return id
    .split("-")
    .map((part) => (/^\d/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ")
}

export const AI_GATEWAY_API_KEY_ENV = "AI_GATEWAY_API_KEY"

export function isAiGatewayConfigured(): boolean {
  return Boolean(process.env[AI_GATEWAY_API_KEY_ENV]?.trim())
}
