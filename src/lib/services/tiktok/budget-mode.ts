/** Modos con presupuesto diario editable en TikTok Ads API. */
const EDITABLE_DAILY_BUDGET_MODES = new Set([
  "BUDGET_MODE_DAY",
  "BUDGET_MODE_DYNAMIC_DAILY_BUDGET",
])

export function isTikTokEditableDailyBudget(budgetMode?: string | null): boolean {
  if (!budgetMode) return false
  return EDITABLE_DAILY_BUDGET_MODES.has(budgetMode)
}
