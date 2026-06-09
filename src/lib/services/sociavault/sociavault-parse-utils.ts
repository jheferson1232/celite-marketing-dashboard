/** Utilidades para respuestas SociaVault (arrays u objetos indexados). */

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(Math.trunc(value))
    }
  }
  return null
}

/** Convierte array o objeto `{ "0": item, "1": item }` en lista. */
export function valuesFromListOrMap(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
  }
  return []
}

export function normalizeSearchPhrase(phrase: string): string {
  return phrase
    .trim()
    .replace(/^[\s"'«»]+|[\s"'«».,;:!?]+$/g, "")
    .replace(/\s+/g, " ")
}
