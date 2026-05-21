import axios from "axios"
import { getPurchasesFromActions } from "./purchases"
import { getMetaClient } from "./meta"
import type { DateRange, MetaAction, MetaInsightsResponse } from "./types"

export interface PurchasesByGender {
  male: number
  female: number
  unknown: number
}

interface GenderInsightRow {
  ad_id?: string
  gender?: string
  actions?: MetaAction[]
}

function emptyGenderCounts(): PurchasesByGender {
  return { male: 0, female: 0, unknown: 0 }
}

function addPurchasesToGender(
  counts: PurchasesByGender,
  gender: string | undefined,
  purchases: number
): PurchasesByGender {
  const key = (gender || "unknown").toLowerCase()
  if (key === "male") return { ...counts, male: counts.male + purchases }
  if (key === "female") return { ...counts, female: counts.female + purchases }
  return { ...counts, unknown: counts.unknown + purchases }
}

export async function fetchPurchaseGenderByAdId(
  dateRange: DateRange
): Promise<Map<string, PurchasesByGender>> {
  const api = getMetaClient()
  const timeRange = JSON.stringify({
    since: dateRange.from,
    until: dateRange.to,
  })

  const rows: GenderInsightRow[] = []
  let response = await api.get<MetaInsightsResponse>("/insights", {
    params: {
      level: "ad",
      breakdowns: "gender",
      fields: "ad_id,actions",
      time_range: timeRange,
      limit: 500,
    },
  })

  rows.push(...(response.data.data as GenderInsightRow[]))

  let nextUrl = response.data.paging?.next
  while (nextUrl) {
    const nextResponse = await axios.get<MetaInsightsResponse>(nextUrl)
    rows.push(...(nextResponse.data.data as GenderInsightRow[]))
    nextUrl = nextResponse.data.paging?.next
  }

  const byAdId = new Map<string, PurchasesByGender>()

  for (const row of rows) {
    const adId = row.ad_id
    if (!adId) continue

    const purchases = Math.round(getPurchasesFromActions(row.actions))
    if (purchases <= 0) continue

    const current = byAdId.get(adId) ?? emptyGenderCounts()
    byAdId.set(adId, addPurchasesToGender(current, row.gender, purchases))
  }

  return byAdId
}
