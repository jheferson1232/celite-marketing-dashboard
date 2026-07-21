/** Etiquetas de trigger (valor en runtime, sin tipos en server actions). */
export const TIKTOK_AGENT_TRIGGER_LABEL: Record<string, string> = {
  manual: "Manual",
  morning_6am: "⏰ 6am",
  morning_8am: "🌅 8am",
  afternoon_2pm: "🌞 2pm",
  evening_8pm: "🌙 8pm",
}

export const TIKTOK_AGENT_ACTION_KIND_LABEL: Record<string, string> = {
  pause_adgroup: "Pausa conjunto",
  pause_campaign: "Pausa campaña",
  scale_adgroup: "Escalado",
  activate_campaign: "Activación 6am",
}

/** Resumen corto para la columna Acciones de «Últimas corridas». */
export function summarizeTikTokAgentActions(
  actions: Array<{ kind: string; applied?: boolean }>
): string {
  if (actions.length === 0) return "0"
  let pauses = 0
  let scales = 0
  let activates = 0
  for (const action of actions) {
    if (action.kind === "scale_adgroup") scales += 1
    else if (action.kind === "activate_campaign") activates += 1
    else pauses += 1
  }
  const parts: string[] = []
  if (pauses > 0) parts.push(`${pauses} pausa${pauses === 1 ? "" : "s"}`)
  if (scales > 0) parts.push(`${scales} escalado${scales === 1 ? "" : "s"}`)
  if (activates > 0)
    parts.push(`${activates} activaci${activates === 1 ? "ón" : "ones"}`)
  return parts.length > 0 ? parts.join(" · ") : String(actions.length)
}
