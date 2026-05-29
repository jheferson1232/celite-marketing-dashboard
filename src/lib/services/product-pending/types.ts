export type PendingProductStatus =
  | "IMPORTED"
  | "SEARCHING"
  | "MATCHED"
  | "NO_MATCH"
  | "ERROR"

export type PendingProductMatchRecord = {
  id: string
  matchType: "campaign" | "video"
  externalId: string | null
  title: string | null
  pageName: string | null
  score: number
  previewUrl: string | null
  landingUrl: string | null
  payload: Record<string, unknown>
  isFavorite: boolean
  createdAt: Date
}

export type PendingProductRecord = {
  id: string
  dropiId: string
  name: string
  url: string | null
  imageUrl: string | null
  imageUrls: string[]
  sku: string | null
  price: number | null
  status: PendingProductStatus
  lastSyncedAt: Date | null
  lastError: string | null
  createdAt: Date
  updatedAt: Date
  matches: PendingProductMatchRecord[]
}

export type PendingSyncSummary = {
  runId: string
  imported: number
  searched: number
  matched: number
  noMatch: number
  errors: number
  source: "playwright" | "json_override" | "api"
}
