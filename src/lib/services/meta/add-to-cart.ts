import type { MetaAction } from "./types"

const ADD_TO_CART_ACTION_TYPES = [
  "omni_add_to_cart",
  "add_to_cart",
  "offsite_conversion.fb_pixel_add_to_cart",
  "onsite_web_add_to_cart",
  "web_in_store_add_to_cart",
] as const

export function getAddToCartFromActions(
  actions: MetaAction[] | undefined
): number {
  if (!actions?.length) return 0

  for (const actionType of ADD_TO_CART_ACTION_TYPES) {
    const value = actions.find((a) => a.action_type === actionType)?.value
    if (value === undefined || value === "") continue
    const parsed = parseFloat(value)
    if (!Number.isNaN(parsed) && parsed > 0) return Math.round(parsed)
  }

  return 0
}
