export const META_ACCESS_TOKEN_ENV = "META_ACCESS_TOKEN"
export const META_AD_ACCOUNT_ID_ENV = "META_AD_ACCOUNT_ID"

const META_CONFIG_ERROR_MARKERS = [
  "META_ACCESS_TOKEN",
  "META_AD_ACCOUNT_ID",
  "son requeridas",
  "es requerida",
] as const

/** Variables de Meta Ads ausentes o vacías en el entorno del servidor. */
export function getMissingMetaEnvVars(): string[] {
  const missing: string[] = []
  if (!process.env[META_ACCESS_TOKEN_ENV]?.trim()) {
    missing.push(META_ACCESS_TOKEN_ENV)
  }
  if (!process.env[META_AD_ACCOUNT_ID_ENV]?.trim()) {
    missing.push(META_AD_ACCOUNT_ID_ENV)
  }
  return missing
}

export function isMetaEnvConfigured(): boolean {
  return getMissingMetaEnvVars().length === 0
}

export function getMetaEnvSetupMessage(missing?: string[]): string {
  const vars = missing ?? getMissingMetaEnvVars()
  if (vars.length === 0) return ""

  return (
    `Faltan variables de entorno: ${vars.join(", ")}. ` +
    "En local, agrega el token y el ID de cuenta de Meta Ads en tu archivo `.env` y reinicia `pnpm dev`. " +
    "En Vercel, configúralas en Settings → Environment Variables (entorno Production) y vuelve a desplegar."
  )
}

export class MetaEnvNotConfiguredError extends Error {
  readonly missingVars: string[]

  constructor(missingVars: string[]) {
    super(getMetaEnvSetupMessage(missingVars))
    this.name = "MetaEnvNotConfiguredError"
    this.missingVars = missingVars
  }
}

export function assertMetaEnvConfigured(): void {
  const missing = getMissingMetaEnvVars()
  if (missing.length > 0) {
    throw new MetaEnvNotConfiguredError(missing)
  }
}

export function isMetaConfigError(error: unknown): boolean {
  if (error instanceof MetaEnvNotConfiguredError) return true
  if (!(error instanceof Error)) return false
  const message = error.message
  return META_CONFIG_ERROR_MARKERS.some((marker) => message.includes(marker))
}
