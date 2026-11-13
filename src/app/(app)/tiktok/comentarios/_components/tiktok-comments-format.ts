import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { DASHBOARD_TIMEZONE } from "@/lib/date"
import type { TikTokCommentClassification } from "@/lib/services/tiktok/comments/types"

export function tikTokPostUrl(
  profileName: string | null,
  tiktokItemId: string | null
): string | null {
  const itemId = tiktokItemId?.trim()
  if (!itemId) return null
  const handle = profileName?.trim().replace(/^@/, "").replace(/\s+/g, "_")
  if (handle) return `https://www.tiktok.com/@${handle}/video/${itemId}`
  return `https://www.tiktok.com/video/${itemId}`
}

export function formatRelative(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return formatDistanceToNow(date, { addSuffix: true, locale: es })
}

export function formatLimaTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleTimeString("es-PE", {
    timeZone: DASHBOARD_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatLimaDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString("es-PE", {
    timeZone: DASHBOARD_TIMEZONE,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** Fecha YYYY-MM-DD en hora de Lima. */
export function limaDayKey(iso: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DASHBOARD_TIMEZONE,
  }).format(typeof iso === "string" ? new Date(iso) : iso)
}

export const CLASSIFICATION_LABEL: Record<TikTokCommentClassification, string> =
  {
    spam: "Spam",
    troll: "Troll o negativo",
    question: "Pregunta",
    positive: "Positivo",
    neutral: "Neutral",
  }
