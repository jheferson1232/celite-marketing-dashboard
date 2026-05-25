export type LaunchProgressStage =
  | "staging"
  | "resolve_campaign"
  | "resolve_videos"
  | "resolve_covers"
  | "create_adgroups"
  | "enable_campaign"
  | "done"
  | "error"

export type LaunchProgress = {
  campaignId: string
  stage: LaunchProgressStage
  current: number
  total: number
  message: string
  updatedAt: number
}

const launchProgressStore = new Map<string, LaunchProgress>()
const PROGRESS_TTL_MS = 15 * 60 * 1000

function cleanupExpiredProgress(now = Date.now()): void {
  for (const [key, value] of launchProgressStore) {
    if (now - value.updatedAt > PROGRESS_TTL_MS) {
      launchProgressStore.delete(key)
    }
  }
}

export function setLaunchProgress(
  campaignId: string,
  update: Omit<LaunchProgress, "campaignId" | "updatedAt">
): void {
  cleanupExpiredProgress()
  launchProgressStore.set(campaignId, {
    campaignId,
    ...update,
    updatedAt: Date.now(),
  })
}

export function getLaunchProgress(
  campaignId: string
): LaunchProgress | null {
  cleanupExpiredProgress()
  return launchProgressStore.get(campaignId) ?? null
}

export function clearLaunchProgress(campaignId: string): void {
  launchProgressStore.delete(campaignId)
}

export function launchProgressMessage(
  stage: LaunchProgressStage,
  current: number,
  total: number
): string {
  switch (stage) {
    case "staging":
      return `Descargando videos (${current}/${total})…`
    case "resolve_campaign":
      return "Resolviendo campaña en TikTok…"
    case "resolve_videos":
      return `Subiendo videos (${current}/${total})…`
    case "resolve_covers":
      return `Generando portadas (${current}/${total})…`
    case "create_adgroups":
      return `Creando conjuntos y anuncios (${current}/${total})…`
    case "enable_campaign":
      return "Activando campaña en TikTok…"
    case "done":
      return "Publicación completada"
    case "error":
      return "Error durante la publicación"
    default:
      return "Publicando en TikTok…"
  }
}
