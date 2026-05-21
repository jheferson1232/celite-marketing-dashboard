/** Tasa fija PEN → COP (solo pestaña Resumen). COP por 1 PEN. */
const DEFAULT_PEN_TO_COP_RATE = 1050

export function getPenToCopRate(): number {
  const raw = process.env.PEN_TO_COP_RATE
  if (!raw?.trim()) return DEFAULT_PEN_TO_COP_RATE

  const rate = parseFloat(raw)
  if (Number.isNaN(rate) || rate <= 0) return DEFAULT_PEN_TO_COP_RATE

  return rate
}

/** Convierte soles (PEN) a pesos colombianos (COP) con tasa fija. */
export function convertPenToCop(pen: number): number {
  const safePen = Number.isFinite(pen) ? pen : 0
  const rate = getPenToCopRate()
  const cop = safePen * rate
  return Number.isFinite(cop) ? cop : 0
}
