import {
  getMissingMetaEnvVars,
  isMetaEnvConfigured,
} from "../meta-env"

export const ANTHROPIC_API_KEY_ENV = "ANTHROPIC_API_KEY"
export const META_PAGE_ACCESS_TOKEN_ENV = "META_PAGE_ACCESS_TOKEN"
export const META_PAGE_ID_ENV = "META_PAGE_ID"

export function isAnthropicConfigured(): boolean {
  return Boolean(process.env[ANTHROPIC_API_KEY_ENV]?.trim())
}

export function getMissingMetaCommentAgentEnv(): string[] {
  const missing: string[] = []
  if (!isAnthropicConfigured()) {
    missing.push(ANTHROPIC_API_KEY_ENV)
  }
  missing.push(...getMissingMetaEnvVars())
  return missing
}

export function getMetaCommentAgentSetupMessage(missing?: string[]): string {
  const vars = missing ?? getMissingMetaCommentAgentEnv()
  if (vars.length === 0) return ""

  const hints: string[] = [
    `Faltan variables: ${vars.join(", ")}.`,
    "Para moderar comentarios necesitás token de Página (`META_PAGE_ACCESS_TOKEN`) o permisos `pages_read_engagement` + `pages_manage_engagement` en `META_ACCESS_TOKEN`.",
  ]
  return hints.join(" ")
}
