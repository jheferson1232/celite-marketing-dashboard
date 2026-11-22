import "server-only"

import { buildDateKeys, getDashboardToday, getDashboardYesterday } from "@/lib/date"
import { getMetaInformeDateRange } from "@/lib/meta-informe"
import { getMetaClient } from "./meta"
import { metaGraphGet } from "./meta-graph-retry"
import { withMetaCache } from "./meta-cache"
import { withMetaDashboardAccount } from "./meta-dashboard-account.server"
import { normalizeMetaId } from "./meta-ids"
import { getPurchasesFromInsight } from "./purchase-metrics"
import {
  getInformeCpaTarget,
  resolveInformeAccountId,
  resolveInformeAccountInfo,
} from "./meta-operative-service"
import {
  computeInformeAccion,
  type InformeAccion,
  type InformeAccionReason,
} from "./meta-informe-rules"
import type { MetaInsightRow, MetaInsightsResponse } from "./types"

const ADS_TTL_MS = 5 * 60 * 1000
/** Estados en los que el anuncio entrega. */
const DELIVERING = new Set(["ACTIVE", "IN_PROCESS", "WITH_ISSUES"])

export type InformeAdRow = {
  metaId: string
  name: string
  isActive: boolean
  effectiveStatus: string
  dayCells: { date: string; spend: number; purchases: number }[]
  spendPeriod: number
  purchasesPeriod: number
  cpaPeriod: number
  accion: InformeAccion
  accionReason: InformeAccionReason
}

type AdInsightRow = MetaInsightRow & { ad_id?: string; ad_name?: string }

type AdStatusRow = { id?: string; name?: string; effective_status?: string }

async function fetchAllPages<T>(first: { data?: T[]; paging?: { next?: string } }) {
  const rows: T[] = [...(first.data ?? [])]
  let next = first.paging?.next
  while (next) {
    const page = await metaGraphGet<{ data?: T[]; paging?: { next?: string } }>(next)
    rows.push(...(page.data ?? []))
    next = page.paging?.next
  }
  return rows
}

async function loadAdsetAds(adsetId: string): Promise<{
  insights: AdInsightRow[]
  statuses: AdStatusRow[]
}> {
  const api = getMetaClient()
  const range = getMetaInformeDateRange()
  const filtering = JSON.stringify([
    { field: "adset.id", operator: "EQUAL", value: adsetId },
  ])

  const [insightsRes, statusRes] = await Promise.all([
    api.get<MetaInsightsResponse>("/insights", {
      params: {
        level: "ad",
        fields: "date_start,ad_id,ad_name,spend,actions",
        time_range: JSON.stringify({ since: range.from, until: range.to }),
        time_increment: "1",
        filtering,
        limit: "500",
      },
    }),
    api.get<{ data?: AdStatusRow[]; paging?: { next?: string } }>("/ads", {
      params: {
        fields: "id,name,effective_status",
        filtering,
        limit: "200",
      },
    }),
  ])

  const [insights, statuses] = await Promise.all([
    fetchAllPages<AdInsightRow>(insightsRes.data as { data?: AdInsightRow[] }),
    fetchAllPages<AdStatusRow>(statusRes.data),
  ])
  return { insights, statuses }
}

/**
 * Anuncios de un conjunto con gasto y compras por día del informe,
 * clasificados con el CPA objetivo de la cuenta.
 */
export async function getInformeAdsetAds(input: {
  accountId: string
  adsetId: string
}): Promise<InformeAdRow[]> {
  const accountId = resolveInformeAccountId(input.accountId)
  const adsetId = normalizeMetaId(input.adsetId)
  if (!adsetId) throw new Error("Conjunto inválido.")

  return withMetaDashboardAccount(accountId, async () => {
    const account = await resolveInformeAccountInfo(accountId)
    const target = await getInformeCpaTarget(accountId, account.currency)
    const range = getMetaInformeDateRange()
    const dateKeys = buildDateKeys(range.from, range.to).sort().reverse()
    const today = getDashboardToday()
    const yesterday = getDashboardYesterday()

    const { insights, statuses } = await withMetaCache(
      `meta-informe:adset-ads:v1:${adsetId}:${range.from}:${range.to}`,
      ADS_TTL_MS,
      () => loadAdsetAds(adsetId)
    )

    const byAd = new Map<string, { name: string; days: Map<string, { spend: number; purchases: number }> }>()
    for (const row of insights) {
      const adId = normalizeMetaId(row.ad_id)
      const date = row.date_start?.slice(0, 10)
      if (!adId || !date) continue
      const entry = byAd.get(adId) ?? { name: row.ad_name || `Anuncio ${adId}`, days: new Map() }
      const day = entry.days.get(date) ?? { spend: 0, purchases: 0 }
      day.spend += parseFloat(row.spend || "0")
      day.purchases += getPurchasesFromInsight(row)
      entry.days.set(date, day)
      byAd.set(adId, entry)
    }

    const statusById = new Map(
      statuses.map((s) => [normalizeMetaId(s.id), s] as const)
    )
    // Anuncios activos sin gasto en el periodo también se listan.
    for (const status of statuses) {
      const id = normalizeMetaId(status.id)
      if (!id || byAd.has(id)) continue
      if (!DELIVERING.has((status.effective_status ?? "").toUpperCase())) continue
      byAd.set(id, { name: status.name || `Anuncio ${id}`, days: new Map() })
    }

    const rows: InformeAdRow[] = []
    for (const [metaId, entry] of byAd) {
      const effectiveStatus = (statusById.get(metaId)?.effective_status ?? "").toUpperCase()
      const isActive = DELIVERING.has(effectiveStatus)
      const dayCells = dateKeys.map((date) => ({
        date,
        spend: entry.days.get(date)?.spend ?? 0,
        purchases: entry.days.get(date)?.purchases ?? 0,
      }))
      const spendPeriod = dayCells.reduce((s, d) => s + d.spend, 0)
      const purchasesPeriod = dayCells.reduce((s, d) => s + d.purchases, 0)
      const todayCell = entry.days.get(today) ?? { spend: 0, purchases: 0 }
      const yesterdayCell = entry.days.get(yesterday) ?? { spend: 0, purchases: 0 }
      const result = computeInformeAccion(
        {
          isActive,
          today: todayCell,
          yesterday: yesterdayCell,
          period: { spend: spendPeriod, purchases: purchasesPeriod },
        },
        target
      )
      rows.push({
        metaId,
        name: statusById.get(metaId)?.name || entry.name,
        isActive,
        effectiveStatus,
        dayCells,
        spendPeriod,
        purchasesPeriod,
        cpaPeriod: purchasesPeriod > 0 ? spendPeriod / purchasesPeriod : 0,
        // Reactivar un anuncio no se sugiere: la decisión es a nivel conjunto.
        accion: result.accion === "reactivar" ? "apagado" : result.accion,
        accionReason: result.accion === "reactivar" ? { kind: "apagado" } : result.reason,
      })
    }

    return rows.sort(
      (a, b) =>
        Number(b.isActive) - Number(a.isActive) || b.spendPeriod - a.spendPeriod
    )
  })
}
