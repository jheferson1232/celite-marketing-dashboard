/** Meta a veces devuelve ids numéricos; normalizar evita 0 conjuntos por comparación estricta. */
export function normalizeMetaId(value: unknown): string {
  if (value === null || value === undefined) return ""
  return String(value).trim()
}
