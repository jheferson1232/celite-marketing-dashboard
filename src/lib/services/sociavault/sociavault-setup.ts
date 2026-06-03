/** Normaliza la API key (espacios, comillas al pegar en Vercel). */
export function readSociaVaultApiKey(): string | null {
  const raw = process.env.SOCIAVAULT_API_KEY?.trim()
  if (!raw) return null

  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    const unquoted = raw.slice(1, -1).trim()
    return unquoted.length > 0 ? unquoted : null
  }

  return raw
}

export function isSociaVaultApiKeyConfigured(): boolean {
  return readSociaVaultApiKey() != null
}
