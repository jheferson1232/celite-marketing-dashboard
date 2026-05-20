import type { MetaAction } from "./types"

const PURCHASE_ACTION_TYPES = [
  "omni_purchase",
  "purchase",
  "complete_payment",
  "offsite_conversion.fb_pixel_purchase",
  "web_in_store_purchase",
] as const

export function getPurchasesFromActions(
  actions: MetaAction[] | undefined
): number {
  if (!actions?.length) return 0

  for (const actionType of PURCHASE_ACTION_TYPES) {
    const value = actions.find((a) => a.action_type === actionType)?.value
    if (value === undefined || value === "") continue
    const parsed = parseFloat(value)
    if (!Number.isNaN(parsed) && parsed > 0) return parsed
  }

  return 0
}

export function getPurchaseCpaFromActions(
  actions: MetaAction[] | undefined,
  costPerActionType: MetaAction[] | undefined,
  spend: number
): number {
  const fromMeta = costPerActionType?.find(
    (a) => a.action_type === "omni_purchase" || a.action_type === "purchase"
  )?.value

  const purchases = getPurchasesFromActions(actions)
  if (purchases > 0 && spend > 0) return spend / purchases
  if (fromMeta) return parseFloat(fromMeta) || 0
  return 0
}
