/**
 * Modelo del agente de comentarios TikTok, servido por Vercel AI Gateway
 * (Meta sigue con Claude vía ANTHROPIC_API_KEY).
 * El SDK `ai` enruta los ids `proveedor/modelo` por el Gateway y se autentica con
 * `AI_GATEWAY_API_KEY` (API key creada en Vercel → AI Gateway → API Keys).
 */
export const COMMENT_AGENT_MODEL = "google/gemini-3.5-flash-lite"
export const COMMENT_AGENT_MODEL_LABEL = "Gemini 3.5 Flash Lite"

export const AI_GATEWAY_API_KEY_ENV = "AI_GATEWAY_API_KEY"

export function isAiGatewayConfigured(): boolean {
  return Boolean(process.env[AI_GATEWAY_API_KEY_ENV]?.trim())
}
