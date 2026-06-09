import {
  differenceInCalendarDays,
  format,
  parseISO,
  subDays,
} from "date-fns"
import { es } from "date-fns/locale"
import type {
  FacebookAdFormat,
  FacebookAdLibraryAd,
} from "@/lib/services/sociavault/facebook-ad-library"

export type MetaLibraryTimelinePoint = {
  date: string
  label: string
  active: number
}

export type MetaLibraryFormatBreakdown = {
  format: FacebookAdFormat
  label: string
  count: number
  percent: number
}

export type MetaLibraryLandingPageRow = {
  path: string
  fullUrl: string
  count: number
  percent: number
}

export type MetaLibraryAnalytics = {
  timeline: MetaLibraryTimelinePoint[]
  formats: MetaLibraryFormatBreakdown[]
  landingPages: MetaLibraryLandingPageRow[]
  survivalRate: number
  topByDuration: FacebookAdLibraryAd[]
}

const FORMAT_LABELS: Record<FacebookAdFormat, string> = {
  video: "Videos",
  image: "Imágenes",
  dco: "DCO",
  other: "Otros",
}

function parseAdDate(value: string | null): Date | null {
  if (!value) return null
  const parsed = parseISO(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function getAdDaysActive(ad: FacebookAdLibraryAd): number {
  const start = parseAdDate(ad.startDate)
  if (!start) return 0
  const end = ad.isActive
    ? new Date()
    : (parseAdDate(ad.endDate) ?? new Date())
  return Math.max(1, differenceInCalendarDays(end, start) + 1)
}

export function formatAdDateRange(ad: FacebookAdLibraryAd): string {
  const start = parseAdDate(ad.startDate)
  if (!start) return "—"
  const startLabel = format(start, "dd MMM yyyy", { locale: es })
  if (ad.isActive) return `${startLabel} → Hoy`
  const end = parseAdDate(ad.endDate)
  if (!end) return startLabel
  return `${startLabel} → ${format(end, "dd MMM yyyy", { locale: es })}`
}

export function facebookAdLibraryUrl(adArchiveId: string): string {
  return `https://www.facebook.com/ads/library/?id=${adArchiveId}`
}

function buildTimeline(ads: FacebookAdLibraryAd[]): MetaLibraryTimelinePoint[] {
  const dated = ads
    .map((ad) => parseAdDate(ad.startDate))
    .filter((date): date is Date => date != null)

  if (dated.length === 0) return []

  const earliest = dated.reduce((min, date) => (date < min ? date : min), dated[0]!)
  const today = new Date()
  const points: MetaLibraryTimelinePoint[] = []
  const stepDays = dated.length > 60 ? 7 : 1

  for (
    let cursor = new Date(earliest);
    cursor <= today;
    cursor = subDays(cursor, -stepDays)
  ) {
    const active = ads.filter((ad) => {
      const start = parseAdDate(ad.startDate)
      if (!start || start > cursor) return false
      if (ad.isActive) return true
      const end = parseAdDate(ad.endDate)
      return end ? end >= cursor : false
    }).length

    points.push({
      date: format(cursor, "yyyy-MM-dd"),
      label: format(cursor, stepDays >= 7 ? "d MMM" : "d MMM", { locale: es }),
      active,
    })
  }

  return points.slice(-30)
}

function buildFormats(ads: FacebookAdLibraryAd[]): MetaLibraryFormatBreakdown[] {
  const counts = new Map<FacebookAdFormat, number>()
  for (const ad of ads) {
    counts.set(ad.format, (counts.get(ad.format) ?? 0) + 1)
  }

  const total = ads.length || 1
  return (["video", "dco", "image", "other"] as const)
    .map((format) => {
      const count = counts.get(format) ?? 0
      return {
        format,
        label: FORMAT_LABELS[format],
        count,
        percent: Math.round((count / total) * 100),
      }
    })
    .filter((row) => row.count > 0)
}

function buildLandingPages(ads: FacebookAdLibraryAd[]): MetaLibraryLandingPageRow[] {
  const counts = new Map<string, { path: string; fullUrl: string; count: number }>()

  for (const ad of ads) {
    if (!ad.linkUrl) continue
    try {
      const url = new URL(ad.linkUrl)
      const path = url.pathname || "/"
      const key = `${url.hostname}${path}`
      const existing = counts.get(key)
      if (existing) {
        existing.count += 1
      } else {
        counts.set(key, { path, fullUrl: ad.linkUrl, count: 1 })
      }
    } catch {
      continue
    }
  }

  const total = [...counts.values()].reduce((sum, row) => sum + row.count, 0) || 1

  return [...counts.values()]
    .map((row) => ({
      ...row,
      percent: Math.round((row.count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
}

export function buildMetaLibraryAnalytics(
  ads: FacebookAdLibraryAd[]
): MetaLibraryAnalytics {
  const activeCount = ads.filter((ad) => ad.isActive).length
  const survivalRate =
    ads.length > 0 ? Math.round((activeCount / ads.length) * 100) : 0

  const topByDuration = [...ads]
    .sort((a, b) => getAdDaysActive(b) - getAdDaysActive(a))
    .slice(0, 10)

  return {
    timeline: buildTimeline(ads),
    formats: buildFormats(ads),
    landingPages: buildLandingPages(ads),
    survivalRate,
    topByDuration,
  }
}
