/** Configuración de búsqueda SociaVault (créditos ≈ 1 por llamada API). */

export type SociaVaultSearchConfig = {
  maxQueries: number
  /** Máximo de videos TikTok guardados por consulta. */
  maxMatchesPerPlatform: number
  searchInstagram: boolean
  searchTikTok: boolean
  imageVision: boolean
  instagramEnrichPostInfo: boolean
  instagramMaxEnrich: number
}

function parseBoolEnv(key: string, defaultValue: boolean): boolean {
  const raw = process.env[key]?.trim().toLowerCase()
  if (!raw) return defaultValue
  if (raw === "false" || raw === "0" || raw === "no") return false
  if (raw === "true" || raw === "1" || raw === "yes") return true
  return defaultValue
}

function isEconomyMode(): boolean {
  return parseBoolEnv("SOCIAVAULT_ECONOMY_MODE", true)
}

function parseMaxQueries(): number {
  const raw = process.env.SOCIAVAULT_MAX_QUERIES?.trim()
  const defaultMax = 1
  if (!raw) return defaultMax
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1) return defaultMax
  const cap = isEconomyMode() ? 1 : 6
  return Math.min(n, cap)
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export function getSociaVaultSearchConfig(): SociaVaultSearchConfig {
  const economy = isEconomyMode()

  return {
    maxQueries: parseMaxQueries(),
    maxMatchesPerPlatform: parsePositiveInt(
      process.env.SOCIAVAULT_MAX_MATCHES_PER_PLATFORM,
      30
    ),
    searchInstagram: parseBoolEnv(
      "SOCIAVAULT_SEARCH_INSTAGRAM",
      parseBoolEnv("SOCIAVAULT_SEARCH_META", false)
    ),
    searchTikTok: parseBoolEnv("SOCIAVAULT_SEARCH_TIKTOK", true),
    imageVision: parseBoolEnv("SOCIAVAULT_IMAGE_VISION", !economy),
    instagramEnrichPostInfo: parseBoolEnv("SOCIAVAULT_INSTAGRAM_ENRICH", true),
    instagramMaxEnrich: parsePositiveInt(
      process.env.SOCIAVAULT_INSTAGRAM_MAX_ENRICH,
      30
    ),
  }
}

export function estimateSociaVaultCreditsPerSearch(
  config: SociaVaultSearchConfig = getSociaVaultSearchConfig()
): number {
  let perQuery = 0
  if (config.searchInstagram) {
    perQuery += 1
    if (config.instagramEnrichPostInfo) {
      perQuery += config.instagramMaxEnrich
    }
  }
  if (config.searchTikTok) perQuery += 1
  return config.maxQueries * perQuery
}

export function describeSociaVaultCreditsPerSearch(
  config: SociaVaultSearchConfig = getSociaVaultSearchConfig()
): string {
  const n = estimateSociaVaultCreditsPerSearch(config)
  const parts: string[] = []
  if (config.searchInstagram) {
    parts.push(
      config.instagramEnrichPostInfo
        ? `Instagram (+${config.instagramMaxEnrich} detalle)`
        : "Instagram"
    )
  }
  if (config.searchTikTok) parts.push("TikTok")
  const platforms = parts.length > 0 ? parts.join(" + ") : "ninguna"
  return `~${n} crédito${n === 1 ? "" : "s"}/búsqueda (${platforms})`
}
