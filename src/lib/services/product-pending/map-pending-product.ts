import { shouldHideStoredMatch } from "@/lib/services/sociavault/match-relevance-filter"
import type { PendingProductMatchRecord, PendingProductRecord } from "./types"
import {
  parsePendingImageUrls,
  primaryPendingImageUrl,
} from "./pending-product-images"

export function mapPendingProductRow(row: {
  id: string
  dropiId: string
  name: string
  url: string | null
  imageUrl: string | null
  imageUrls: unknown
  sku: string | null
  price: number | null
  status: string
  lastSyncedAt: Date | null
  lastError: string | null
  createdAt: Date
  updatedAt: Date
  matches: Array<{
    id: string
    matchType: string
    externalId: string | null
    title: string | null
    pageName: string | null
    score: number
    previewUrl: string | null
    landingUrl: string | null
    payload: unknown
    isFavorite?: boolean
    createdAt: Date
  }>
}): PendingProductRecord {
  const imageUrls = parsePendingImageUrls(row.imageUrls, row.imageUrl)

  return {
    id: row.id,
    dropiId: row.dropiId,
    name: row.name,
    url: row.url,
    imageUrl: primaryPendingImageUrl(imageUrls),
    imageUrls,
    sku: row.sku,
    price: row.price,
    status: row.status as PendingProductRecord["status"],
    lastSyncedAt: row.lastSyncedAt,
    lastError:
      row.lastError && /Meta Ad Library|facebook-ad-library/i.test(row.lastError)
        ? null
        : row.lastError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    matches: row.matches
      .map((m): PendingProductMatchRecord => {
        const payload =
          m.payload && typeof m.payload === "object" && !Array.isArray(m.payload)
            ? (m.payload as Record<string, unknown>)
            : {}
        return {
          id: m.id,
          matchType: m.matchType === "video" ? "video" : "campaign",
          externalId: m.externalId,
          title: m.title,
          pageName: m.pageName,
          score: m.score,
          previewUrl: m.previewUrl,
          landingUrl: m.landingUrl,
          payload,
          isFavorite: m.isFavorite ?? false,
          createdAt: m.createdAt,
        }
      })
      .filter((m) => {
        const platform = m.payload.platform
        if (platform === "facebook" || m.matchType === "campaign") {
          return false
        }
        if (platform !== "tiktok") {
          return false
        }
        return !shouldHideStoredMatch(
          { title: m.title, pageName: m.pageName, payload: m.payload },
          row.name
        )
      }),
  }
}
