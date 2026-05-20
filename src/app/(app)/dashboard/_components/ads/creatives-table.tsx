"use client"

import * as React from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  RiArrowUpLine,
  RiArrowDownLine,
  RiPlayCircleLine,
  RiImageLine,
} from "@remixicon/react"
import {
  META_DASHBOARD_CURRENCY,
  type CurrencyCode,
} from "@/lib/format"
import type { AdInsightRow } from "@/lib/services/meta/types"
import { CreativePreviewImage } from "./creative-preview-image"
import {
  MetricKey,
  METRIC_OPTIONS,
  getMetricValue,
  formatMetricValue,
  getCreativeKey,
  extractPurchases,
  extractPurchaseValue,
  extractRoas,
  mergeEarliestCreatedTime,
} from "./utils"
import { cn } from "@/lib/utils"

interface CreativeAdsTableProps {
  rows: AdInsightRow[]
  currency?: CurrencyCode
}

function mergeGroup(group: AdInsightRow[]): AdInsightRow & { _count: number } {
  const base = { ...group[0] }
  const spend = group.reduce((s, r) => s + (parseFloat(r.spend) || 0), 0)
  const impressions = group.reduce((s, r) => s + (parseFloat(r.impressions) || 0), 0)
  const clicks = group.reduce((s, r) => s + (parseFloat(r.clicks) || 0), 0)

  base.spend = String(spend)
  base.impressions = String(impressions)
  base.clicks = String(clicks)
  base.ctr = impressions > 0 ? String((clicks / impressions) * 100) : "0"
  base.cpc = clicks > 0 ? String(spend / clicks) : "0"

  // Merge actions
  const am = new Map<string, number>()
  const avm = new Map<string, number>()
  const cm = new Map<string, number>()

  for (const r of group) {
    for (const a of r.actions || []) {
      am.set(a.action_type, (am.get(a.action_type) || 0) + (parseFloat(a.value) || 0))
    }
    for (const a of r.action_values || []) {
      avm.set(a.action_type, (avm.get(a.action_type) || 0) + (parseFloat(a.value) || 0))
    }
    for (const a of r.cost_per_action_type || []) {
      cm.set(a.action_type, (cm.get(a.action_type) || 0) + (parseFloat(a.value) || 0))
    }
  }

  if (am.size) base.actions = Array.from(am.entries()).map(([t, v]) => ({ action_type: t, value: String(v) }))
  if (avm.size) base.action_values = Array.from(avm.entries()).map(([t, v]) => ({ action_type: t, value: String(v) }))
  if (cm.size) base.cost_per_action_type = Array.from(cm.entries()).map(([t, v]) => ({ action_type: t, value: String(v / group.length) }))

  // Weighted ROAS
  const totalPurchaseValue = group.reduce((s, r) => s + extractPurchaseValue(r), 0)
  if (spend > 0) {
    base.purchase_roas = [{ action_type: "omni_purchase_roas", value: String(totalPurchaseValue / spend) }]
  }

  const best = group.reduce((a, b) => (parseFloat(a.spend) || 0) >= (parseFloat(b.spend) || 0) ? a : b)
  base.thumbnail_url = best.thumbnail_url
  base.image_url = best.image_url
  base.video_url = best.video_url
  base.video_id = best.video_id
  base.created_time = mergeEarliestCreatedTime(group) ?? best.created_time

  return { ...base, _count: group.length }
}

export function CreativeAdsTable({
  rows,
  currency = META_DASHBOARD_CURRENCY,
}: CreativeAdsTableProps) {
  const [sortKey, setSortKey] = React.useState<MetricKey>("spend")
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc")

  const grouped = React.useMemo(() => {
    const map = new Map<string, AdInsightRow[]>()
    for (const r of rows) {
      const k = getCreativeKey(r)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(r)
    }
    return Array.from(map.values()).map(mergeGroup)
  }, [rows])

  const sorted = React.useMemo(() => {
    return [...grouped].sort((a, b) => {
      const va = getMetricValue(a, sortKey)
      const vb = getMetricValue(b, sortKey)
      return sortDir === "desc" ? vb - va : va - vb
    })
  }, [grouped, sortKey, sortDir])

  const totals = React.useMemo(() => {
    const totalSpend = grouped.reduce((s, r) => s + (parseFloat(r.spend) || 0), 0)
    const totalImpressions = grouped.reduce((s, r) => s + (parseFloat(r.impressions) || 0), 0)
    const totalClicks = grouped.reduce((s, r) => s + (parseFloat(r.clicks) || 0), 0)
    const totalPurchases = grouped.reduce((s, r) => s + extractPurchases(r), 0)
    const totalPurchaseValue = grouped.reduce((s, r) => s + extractPurchaseValue(r), 0)

    return {
      spend: totalSpend,
      impressions: totalImpressions,
      clicks: totalClicks,
      purchases: totalPurchases,
      purchaseValue: totalPurchaseValue,
      ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
      roas: totalSpend > 0 ? totalPurchaseValue / totalSpend : 0,
      cpa: totalPurchases > 0 ? totalSpend / totalPurchases : 0,
    }
  }, [grouped])

  const handleSort = (key: MetricKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  return (
    <div className="rounded-lg border bg-background">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[300px]">Creativo</TableHead>
            {METRIC_OPTIONS.map((m) => (
              <TableHead
                key={m.key}
                className="cursor-pointer text-right transition-colors hover:text-foreground"
                onClick={() => handleSort(m.key)}
              >
                <div className="flex items-center justify-end gap-1">
                  {m.label}
                  {sortKey === m.key && (
                    sortDir === "desc" ? <RiArrowDownLine className="size-3" /> : <RiArrowUpLine className="size-3" />
                  )}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row) => (
            <TableRow key={row.ad_id} className="group">
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="relative size-12 shrink-0 overflow-hidden rounded border bg-muted">
                    {row.thumbnail_url || row.image_url ? (
                      <CreativePreviewImage
                        thumbnailUrl={row.thumbnail_url}
                        imageUrl={row.image_url}
                        alt=""
                        className="size-full"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        {row.video_id ? <RiPlayCircleLine className="size-6 text-muted-foreground" /> : <RiImageLine className="size-6 text-muted-foreground" />}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={row.ad_name}>
                      {row.ad_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row._count} anuncio{row._count === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
              </TableCell>
              {METRIC_OPTIONS.map((m) => (
                <TableCell key={m.key} className="text-right tabular-nums">
                  {formatMetricValue(getMetricValue(row, m.key), m.key, currency)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
        <TableFooter className="bg-muted/50 font-medium">
          <TableRow>
            <TableCell>Totales / Promedios</TableCell>
            <TableCell className="text-right tabular-nums">{formatMetricValue(totals.spend, "spend", currency)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatMetricValue(totals.impressions, "impressions", currency)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatMetricValue(totals.clicks, "clicks", currency)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatMetricValue(totals.ctr, "ctr", currency)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatMetricValue(totals.cpc, "cpc", currency)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatMetricValue(totals.roas, "roas", currency)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatMetricValue(totals.purchases, "purchases", currency)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatMetricValue(totals.cpa, "cpa", currency)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}
