export type StorePendingStatus =
  | "IMPORTED"
  | "SEARCHING"
  | "MATCHED"
  | "NO_MATCH"
  | "ERROR"

export type StorePendingCountryStat = {
  code: string
  count: number
}

export type StorePendingCreativeRecord = {
  id: string
  externalId: string | null
  title: string | null
  pageName: string | null
  previewUrl: string | null
  landingUrl: string | null
  isActive: boolean
  mediaType: string | null
  startDate: Date | null
  endDate: Date | null
  score: number
  payload: Record<string, unknown>
  createdAt: Date
}

export type StorePendingSnapshotRecord = {
  id: string
  activeAds: number
  totalAds: number
  creativesSaved: number
  topCountries: StorePendingCountryStat[]
  searchQuery: string | null
  metaPageId: string | null
  createdAt: Date
}

export type StorePendingRecord = {
  id: string
  name: string
  domain: string | null
  pageUrl: string | null
  country: string
  metaPageId: string | null
  logoUrl: string | null
  status: StorePendingStatus
  lastSyncedAt: Date | null
  lastError: string | null
  createdAt: Date
  updatedAt: Date
  latestSnapshot: StorePendingSnapshotRecord | null
  creativeCount: number
  activeCreativeCount: number
}

export type StorePendingDetailRecord = StorePendingRecord & {
  snapshots: StorePendingSnapshotRecord[]
  creatives: StorePendingCreativeRecord[]
}
