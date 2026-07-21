import type { MetaAction } from "./types"

const LEAD_ACTION_TYPES = [
  "lead",
  "onsite_conversion.lead_grouped",
  "leadgen_grouped",
  "onsite_conversion.fb_pixel_lead",
  "offsite_conversion.fb_pixel_lead",
] as const

/** Cantidad de clientes potenciales (leads) desde actions de Meta. */
export function getLeadsFromActions(
  actions: MetaAction[] | undefined
): number {
  if (!actions?.length) return 0

  for (const actionType of LEAD_ACTION_TYPES) {
    const value = actions.find((a) => a.action_type === actionType)?.value
    if (value === undefined || value === "") continue
    const parsed = parseFloat(value)
    if (!Number.isNaN(parsed) && parsed > 0) return Math.round(parsed)
  }

  return 0
}

export function getLeadCplFromActions(
  actions: MetaAction[] | undefined,
  costPerActionType: MetaAction[] | undefined,
  spend: number
): number {
  const leads = getLeadsFromActions(actions)
  if (leads > 0 && spend > 0) return spend / leads

  for (const actionType of LEAD_ACTION_TYPES) {
    const fromMeta = costPerActionType?.find(
      (a) => a.action_type === actionType
    )?.value
    if (fromMeta) {
      const parsed = parseFloat(fromMeta)
      if (!Number.isNaN(parsed) && parsed > 0) return parsed
    }
  }

  return 0
}
