import type { MetaInsightRow } from "./types"

export const META_PURCHASE_ACTION_TYPE = "omni_purchase"

export function getPurchasesFromInsight(
  insight: MetaInsightRow | undefined
): number {
  if (!insight) return 0
  const raw =
    insight.actions?.find(
      (action) => action.action_type === META_PURCHASE_ACTION_TYPE
    )?.value || "0"
  const parsed = parseInt(raw, 10)
  return Number.isNaN(parsed) ? 0 : parsed
}

export function getPurchaseSpendAndCpaFromInsight(
  insight: MetaInsightRow | undefined
): { spend: number; purchases: number; cpa: number } {
  const spend = insight ? parseFloat(insight.spend || "0") : 0
  const purchases = getPurchasesFromInsight(insight)
  return {
    spend,
    purchases,
    cpa: purchases > 0 ? spend / purchases : 0,
  }
}
