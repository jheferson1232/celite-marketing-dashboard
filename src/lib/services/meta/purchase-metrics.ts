import {
  getPurchaseCpaFromActions,
  getPurchasesFromActions,
} from "./purchases"
import type { MetaInsightRow } from "./types"

/** Tipo principal de compra Meta (ventas / OUTCOME_SALES). */
export const META_PURCHASE_ACTION_TYPE = "omni_purchase"

export function getPurchasesFromInsight(
  insight: MetaInsightRow | undefined
): number {
  if (!insight) return 0
  return Math.round(getPurchasesFromActions(insight.actions))
}

export function getPurchaseSpendAndCpaFromInsight(
  insight: MetaInsightRow | undefined
): { spend: number; purchases: number; cpa: number } {
  const spend = insight ? parseFloat(insight.spend || "0") : 0
  const purchases = getPurchasesFromInsight(insight)
  const cpa = insight
    ? getPurchaseCpaFromActions(
        insight.actions,
        insight.cost_per_action_type,
        spend
      )
    : 0
  return {
    spend,
    purchases,
    cpa: purchases > 0 ? spend / purchases : cpa,
  }
}
