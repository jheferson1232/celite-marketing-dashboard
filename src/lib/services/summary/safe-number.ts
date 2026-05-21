export function safeNum(value: unknown): number {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? 0))
  return Number.isFinite(n) ? n : 0
}

/** CPA combinado en COP: gasto total ÷ pedidos (ambos en COP). */
export function computeBlendedCpaCop(
  spendCop: unknown,
  purchases: unknown
): number {
  const spend = safeNum(spendCop)
  const orders = safeNum(purchases)
  if (orders <= 0) return 0
  const cpa = spend / orders
  return Number.isFinite(cpa) ? cpa : 0
}
