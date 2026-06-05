import type {
  StorePending,
  StorePendingCreative,
  StorePendingSnapshot,
} from "@/app/generated/prisma/client"
import type {
  StorePendingCountryStat,
  StorePendingCreativeRecord,
  StorePendingDetailRecord,
  StorePendingRecord,
  StorePendingSnapshotRecord,
  StorePendingStatus,
} from "./types"

type StoreWithRelations = StorePending & {
  snapshots?: StorePendingSnapshot[]
  creatives?: StorePendingCreative[]
  _count?: {
    creatives: number
  }
}

function asStatus(value: string): StorePendingStatus {
  if (
    value === "SEARCHING" ||
    value === "MATCHED" ||
    value === "NO_MATCH" ||
    value === "ERROR"
  ) {
    return value
  }
  return "IMPORTED"
}

function parseTopCountries(value: unknown): StorePendingCountryStat[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      const row = item as { code?: unknown; count?: unknown }
      const code = typeof row.code === "string" ? row.code : null
      const count =
        typeof row.count === "number" && Number.isFinite(row.count)
          ? row.count
          : null
      if (!code || count == null) return null
      return { code, count }
    })
    .filter((item): item is StorePendingCountryStat => item != null)
}

function parsePayload(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

export function mapStoreSnapshotRow(
  row: StorePendingSnapshot
): StorePendingSnapshotRecord {
  return {
    id: row.id,
    activeAds: row.activeAds,
    totalAds: row.totalAds,
    creativesSaved: row.creativesSaved,
    topCountries: parseTopCountries(row.topCountries),
    searchQuery: row.searchQuery,
    metaPageId: row.metaPageId,
    createdAt: row.createdAt,
  }
}

export function mapStoreCreativeRow(
  row: StorePendingCreative
): StorePendingCreativeRecord {
  return {
    id: row.id,
    externalId: row.externalId,
    title: row.title,
    pageName: row.pageName,
    previewUrl: row.previewUrl,
    landingUrl: row.landingUrl,
    isActive: row.isActive,
    mediaType: row.mediaType,
    startDate: row.startDate,
    endDate: row.endDate,
    score: row.score,
    payload: parsePayload(row.payload),
    createdAt: row.createdAt,
  }
}

export function mapStorePendingRow(
  row: StoreWithRelations,
  options?: {
    activeCreativeCount?: number
  }
): StorePendingRecord {
  const latestSnapshot = row.snapshots?.[0]
    ? mapStoreSnapshotRow(row.snapshots[0])
    : null

  const creatives = row.creatives ?? []
  const activeCreativeCount =
    options?.activeCreativeCount ??
    creatives.filter((item) => item.isActive).length

  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    pageUrl: row.pageUrl,
    country: row.country,
    metaPageId: row.metaPageId,
    logoUrl: row.logoUrl,
    status: asStatus(row.status),
    lastSyncedAt: row.lastSyncedAt,
    lastError: row.lastError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    latestSnapshot,
    creativeCount: row._count?.creatives ?? creatives.length,
    activeCreativeCount,
  }
}

export function mapStorePendingDetailRow(
  row: StoreWithRelations
): StorePendingDetailRecord {
  const creatives = (row.creatives ?? []).map(mapStoreCreativeRow)
  const snapshots = (row.snapshots ?? []).map(mapStoreSnapshotRow)

  return {
    ...mapStorePendingRow(row, {
      activeCreativeCount: creatives.filter((item) => item.isActive).length,
    }),
    snapshots,
    creatives,
  }
}
