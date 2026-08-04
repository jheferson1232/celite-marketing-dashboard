import { metaGraphGet } from "./meta-graph-retry"
import { getMetaClient } from "./meta"
import { withMetaCache } from "./meta-cache"
import {
  getPurchasesFromActions,
} from "./purchases"
import type { DateRange, MetaAction, MetaInsightsResponse } from "./types"

const AUDIENCE_TTL_MS = 2 * 60 * 1000

export type AudienceSegment = {
  key: string
  label: string
  spend: number
  purchases: number
  cpa: number
  percent: number
}

export type AudienceDimension = {
  id: string
  title: string
  segments: AudienceSegment[]
  totalSpend: number
  totalPurchases: number
  classifiedPurchases?: number
  coverageNote?: string
  showCoverage: boolean
  cpaAvailable: boolean
}

export type AudienceBreakdowns = {
  dateRange: DateRange
  dimensions: {
    gender: AudienceDimension
    age: AudienceDimension
    device: AudienceDimension
    platform: AudienceDimension
    network: AudienceDimension
    region: AudienceDimension
  }
}

type BreakdownRow = {
  spend?: string
  actions?: MetaAction[]
  cost_per_action_type?: MetaAction[]
  gender?: string
  age?: string
  impression_device?: string
  publisher_platform?: string
  platform_position?: string
  region?: string
}

const ACTIVE_CAMPAIGN_FILTER = JSON.stringify([
  {
    field: "campaign.effective_status",
    operator: "IN",
    value: ["ACTIVE"],
  },
])

const GENDER_LABELS: Record<string, string> = {
  male: "Hombres",
  female: "Mujeres",
  unknown: "Desconocido",
}

const DEVICE_LABELS: Record<string, string> = {
  mobile_app: "Mobile (app)",
  mobile_web: "Mobile (web)",
  desktop: "Desktop",
  unknown: "Other",
  other: "Other",
}

const NETWORK_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  audience_network: "Audience Network",
  messenger: "Messenger",
  unknown: "Other",
  other: "Other",
}

const BAR_COLORS = [
  "bg-pink-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-orange-500",
  "bg-violet-500",
  "bg-red-500",
  "bg-cyan-500",
  "bg-amber-500",
]

export function audienceBarColor(index: number): string {
  return BAR_COLORS[index % BAR_COLORS.length]
}

function genderLabel(key: string): string {
  return GENDER_LABELS[key.toLowerCase()] ?? key
}

function deviceLabel(key: string): string {
  return DEVICE_LABELS[key.toLowerCase()] ?? key
}

function networkLabel(key: string): string {
  return NETWORK_LABELS[key.toLowerCase()] ?? key
}

function platformPlacementLabel(platform: string, position: string): string {
  const p = platform.toLowerCase()
  const pos = position.toLowerCase()

  if (p === "facebook" && pos.includes("reels")) return "Reels FB"
  if (p === "instagram" && pos.includes("reels")) return "Reels IG"
  if (p === "facebook" && pos.includes("stories")) return "Stories FB"
  if (p === "instagram" && pos.includes("stories")) return "Stories IG"
  if (pos === "feed" || pos.includes("feed")) return "Feed"
  if (pos.includes("search")) return "Search"
  if (pos.includes("marketplace")) return "Marketplace"
  if (pos.includes("video")) return "Video"
  if (p === "facebook") return `Facebook · ${position}`
  if (p === "instagram") return `Instagram · ${position}`
  return `${platform} · ${position}`
}

function ageSortKey(age: string): number {
  const match = age.match(/(\d+)/)
  return match ? parseInt(match[1], 10) : 999
}

async function fetchBreakdownRows(
  dateRange: DateRange,
  breakdowns: string
): Promise<BreakdownRow[]> {
  const api = getMetaClient()
  const timeRange = JSON.stringify({
    since: dateRange.from,
    until: dateRange.to,
  })

  const rows: BreakdownRow[] = []
  let response = await api.get<MetaInsightsResponse>("/insights", {
    params: {
      level: "account",
      fields: "spend,actions,cost_per_action_type",
      breakdowns,
      filtering: ACTIVE_CAMPAIGN_FILTER,
      time_range: timeRange,
      limit: "500",
    },
  })

  rows.push(...(response.data.data as BreakdownRow[]))

  let nextUrl = response.data.paging?.next
  while (nextUrl) {
    const nextResponse = await metaGraphGet<MetaInsightsResponse>(nextUrl)
    rows.push(...((nextResponse.data ?? []) as BreakdownRow[]))
    nextUrl = nextResponse.paging?.next
  }

  return rows
}

function aggregateByKey(
  rows: BreakdownRow[],
  keyFn: (row: BreakdownRow) => string | null,
  labelFn: (key: string) => string,
  sortFn?: (segments: AudienceSegment[]) => AudienceSegment[]
): {
  segments: AudienceSegment[]
  totalSpend: number
  totalPurchases: number
} {
  const map = new Map<string, { spend: number; purchases: number }>()

  for (const row of rows) {
    const key = keyFn(row)
    if (!key) continue

    const spend = parseFloat(row.spend || "0")
    const purchases = Math.round(getPurchasesFromActions(row.actions))
    const current = map.get(key) ?? { spend: 0, purchases: 0 }
    map.set(key, {
      spend: current.spend + spend,
      purchases: current.purchases + purchases,
    })
  }

  const totalSpend = [...map.values()].reduce((sum, v) => sum + v.spend, 0)
  const totalPurchases = [...map.values()].reduce(
    (sum, v) => sum + v.purchases,
    0
  )

  let segments: AudienceSegment[] = [...map.entries()].map(([key, value]) => ({
    key,
    label: labelFn(key),
    spend: value.spend,
    purchases: value.purchases,
    cpa: value.purchases > 0 ? value.spend / value.purchases : 0,
    percent:
      totalSpend > 0 ? Math.round((value.spend / totalSpend) * 100) : 0,
  }))

  if (sortFn) {
    segments = sortFn(segments)
  } else {
    segments.sort((a, b) => b.spend - a.spend)
  }

  return { segments, totalSpend, totalPurchases }
}

function collapseTailToOther(
  segments: AudienceSegment[],
  maxVisible = 5
): AudienceSegment[] {
  if (segments.length <= maxVisible) return segments

  const head = segments.slice(0, maxVisible)
  const tail = segments.slice(maxVisible)
  const otherSpend = tail.reduce((sum, s) => sum + s.spend, 0)
  const otherPurchases = tail.reduce((sum, s) => sum + s.purchases, 0)
  const totalSpend = segments.reduce((sum, s) => sum + s.spend, 0)

  if (otherSpend <= 0) return head

  return [
    ...head,
    {
      key: "other",
      label: "Other",
      spend: otherSpend,
      purchases: otherPurchases,
      cpa: otherPurchases > 0 ? otherSpend / otherPurchases : 0,
      percent: totalSpend > 0 ? Math.round((otherSpend / totalSpend) * 100) : 0,
    },
  ]
}

function buildGenderDimension(rows: BreakdownRow[]): AudienceDimension {
  const { segments, totalSpend, totalPurchases } = aggregateByKey(
    rows,
    (row) => (row.gender ? row.gender.toLowerCase() : "unknown"),
    genderLabel,
    (items) =>
      items.sort((a, b) => {
        const order = ["male", "female", "unknown"]
        return order.indexOf(a.key) - order.indexOf(b.key)
      })
  )

  const classifiedPurchases = segments
    .filter((s) => s.key === "male" || s.key === "female")
    .reduce((sum, s) => sum + s.purchases, 0)

  return {
    id: "gender",
    title: "Género",
    segments,
    totalSpend,
    totalPurchases,
    classifiedPurchases,
    showCoverage: true,
    cpaAvailable: true,
  }
}

function buildAgeDimension(rows: BreakdownRow[]): AudienceDimension {
  const { segments, totalSpend, totalPurchases } = aggregateByKey(
    rows,
    (row) => row.age ?? null,
    (key) => key,
    (items) =>
      items.sort((a, b) => ageSortKey(a.key) - ageSortKey(b.key))
  )

  return {
    id: "age",
    title: "Edad",
    segments,
    totalSpend,
    totalPurchases,
    classifiedPurchases: totalPurchases,
    showCoverage: true,
    cpaAvailable: true,
  }
}

function buildDeviceDimension(rows: BreakdownRow[]): AudienceDimension {
  const { segments, totalSpend, totalPurchases } = aggregateByKey(
    rows,
    (row) => (row.impression_device ? row.impression_device.toLowerCase() : "unknown"),
    deviceLabel
  )

  const classifiedPurchases = segments
    .filter((s) => s.key !== "unknown" && s.key !== "other")
    .reduce((sum, s) => sum + s.purchases, 0)

  return {
    id: "device",
    title: "Dispositivo",
    segments,
    totalSpend,
    totalPurchases,
    classifiedPurchases,
    showCoverage: true,
    cpaAvailable: true,
  }
}

function buildPlatformDimension(rows: BreakdownRow[]): AudienceDimension {
  const { segments, totalSpend, totalPurchases } = aggregateByKey(
    rows,
    (row) => {
      if (!row.publisher_platform || !row.platform_position) return null
      return `${row.publisher_platform}|${row.platform_position}`
    },
    (key) => {
      const [platform, position] = key.split("|")
      return platformPlacementLabel(platform, position)
    }
  )

  return {
    id: "platform",
    title: "Plataforma",
    segments: collapseTailToOther(segments, 6),
    totalSpend,
    totalPurchases,
    showCoverage: false,
    cpaAvailable: false,
    coverageNote:
      "Distribución por gasto. CPA por placement no disponible en Meta API.",
  }
}

function buildNetworkDimension(rows: BreakdownRow[]): AudienceDimension {
  const { segments, totalSpend, totalPurchases } = aggregateByKey(
    rows,
    (row) =>
      row.publisher_platform ? row.publisher_platform.toLowerCase() : null,
    networkLabel
  )

  return {
    id: "network",
    title: "Red",
    segments,
    totalSpend,
    totalPurchases,
    showCoverage: false,
    cpaAvailable: false,
    coverageNote:
      "Distribución por gasto. CPA por red no disponible en Meta API.",
  }
}

function buildRegionDimension(rows: BreakdownRow[]): AudienceDimension {
  const { segments, totalSpend, totalPurchases } = aggregateByKey(
    rows,
    (row) => row.region ?? null,
    (key) => key
  )

  return {
    id: "region",
    title: "Ciudades",
    segments: collapseTailToOther(segments, 5),
    totalSpend,
    totalPurchases,
    showCoverage: false,
    cpaAvailable: false,
    coverageNote:
      "Meta API expone regiones/departamentos, no ciudades específicas.",
  }
}

async function fetchAudienceBreakdowns(
  dateRange: DateRange
): Promise<AudienceBreakdowns> {
  const [
    genderRows,
    ageRows,
    deviceRows,
    platformRows,
    networkRows,
    regionRows,
  ] = await Promise.all([
    fetchBreakdownRows(dateRange, "gender"),
    fetchBreakdownRows(dateRange, "age"),
    fetchBreakdownRows(dateRange, "impression_device"),
    fetchBreakdownRows(dateRange, "publisher_platform,platform_position"),
    fetchBreakdownRows(dateRange, "publisher_platform"),
    fetchBreakdownRows(dateRange, "region"),
  ])

  return {
    dateRange,
    dimensions: {
      gender: buildGenderDimension(genderRows),
      age: buildAgeDimension(ageRows),
      device: buildDeviceDimension(deviceRows),
      platform: buildPlatformDimension(platformRows),
      network: buildNetworkDimension(networkRows),
      region: buildRegionDimension(regionRows),
    },
  }
}

export async function getMetaAudienceBreakdowns(
  dateRange: DateRange
): Promise<AudienceBreakdowns> {
  const cacheKey = `meta-audience:v1:${dateRange.from}:${dateRange.to}`
  return withMetaCache(cacheKey, AUDIENCE_TTL_MS, () =>
    fetchAudienceBreakdowns(dateRange)
  )
}

export function formatAudienceCpa(value: number): string {
  if (value <= 0) return "—"
  return `$ ${Math.round(value).toLocaleString("es-CO")}`
}

export function formatAudienceSpend(value: number): string {
  if (value <= 0) return "—"
  return `$ ${Math.round(value).toLocaleString("es-CO")}`
}

export function formatAudiencePurchases(value: number): string {
  if (value <= 0) return "—"
  return Math.round(value).toLocaleString("es-CO")
}

export function isGoodAudienceCoverage(
  classified: number,
  total: number
): boolean {
  if (total <= 0) return false
  return classified / total >= 0.9
}
