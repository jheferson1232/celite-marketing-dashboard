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
import {
  RiArrowUpLine,
  RiArrowDownLine,
  RiPlayCircleLine,
  RiImageLine,
  RiExternalLinkLine,
  RiMenLine,
  RiWomenLine,
} from "@remixicon/react"
import {
  formatLandingPagePath,
  META_DASHBOARD_CURRENCY,
  TIKTOK_DASHBOARD_CURRENCY,
  type CurrencyCode,
} from "@/lib/format"
import type { AdInsightRow } from "@/lib/services/meta/types"
import { CreativePreviewImage } from "./creative-preview-image"
import {
  type MetricKey,
  META_CREATIVES_TABLE_METRICS,
  getMetricValue,
  formatMetricValue,
  getCreativeKey,
  extractPurchases,
  extractPurchaseValue,
  mergeEarliestCreatedTime,
  getCreativeCardDisplayTitle,
  pickCampaignNameFromGroup,
  pickHighestSpendRow,
  pickUrlFromGroup,
  sumPurchasesByGender,
  countUniqueIds,
  genderPurchasePercent,
  passesTikTokCreativeSpendFilter,
} from "./utils"
import { cn } from "@/lib/utils"

interface MetaCreativesTableProps {
  rows: AdInsightRow[]
  /** Por defecto Meta (COP). TikTok pasa PEN. */
  currency?: CurrencyCode
}

export interface MergedMetaCreativeRow extends AdInsightRow {
  _count: number
  campaignsCount: number
  adsetsCount: number
  purchasesMale: number
  purchasesFemale: number
  purchasesUnknown: number
}

function mergeMetaCreativeGroup(group: AdInsightRow[]): MergedMetaCreativeRow {
  const base = { ...group[0] }
  const spend = group.reduce((s, r) => s + (parseFloat(r.spend) || 0), 0)
  const impressions = group.reduce(
    (s, r) => s + (parseFloat(r.impressions) || 0),
    0
  )
  const clicks = group.reduce((s, r) => s + (parseFloat(r.clicks) || 0), 0)

  base.spend = String(spend)
  base.impressions = String(impressions)
  base.clicks = String(clicks)
  base.ctr = impressions > 0 ? String((clicks / impressions) * 100) : "0"
  base.cpc = clicks > 0 ? String(spend / clicks) : "0"

  const actionMap = new Map<string, number>()
  const actionValueMap = new Map<string, number>()
  const costMap = new Map<string, number>()

  for (const r of group) {
    for (const a of r.actions || []) {
      actionMap.set(
        a.action_type,
        (actionMap.get(a.action_type) || 0) + (parseFloat(a.value) || 0)
      )
    }
    for (const a of r.action_values || []) {
      actionValueMap.set(
        a.action_type,
        (actionValueMap.get(a.action_type) || 0) + (parseFloat(a.value) || 0)
      )
    }
    for (const a of r.cost_per_action_type || []) {
      costMap.set(
        a.action_type,
        (costMap.get(a.action_type) || 0) + (parseFloat(a.value) || 0)
      )
    }
  }

  if (actionMap.size) {
    base.actions = Array.from(actionMap.entries()).map(([type, val]) => ({
      action_type: type,
      value: String(val),
    }))
  }
  if (actionValueMap.size) {
    base.action_values = Array.from(actionValueMap.entries()).map(
      ([type, val]) => ({
        action_type: type,
        value: String(val),
      })
    )
  }
  if (costMap.size) {
    base.cost_per_action_type = Array.from(costMap.entries()).map(
      ([type, val]) => ({
        action_type: type,
        value: String(val / group.length),
      })
    )
  }

  const totalPurchaseValue = group.reduce(
    (s, r) => s + extractPurchaseValue(r),
    0
  )
  if (spend > 0) {
    base.purchase_roas = [
      {
        action_type: "omni_purchase_roas",
        value: String(totalPurchaseValue / spend),
      },
    ]
  }

  const best = pickHighestSpendRow(group)
  const gender = sumPurchasesByGender(group)

  base.ad_id = best.ad_id
  base.ad_name = best.ad_name
  base.thumbnail_url = best.thumbnail_url
  base.image_url = best.image_url
  base.video_url = best.video_url
  base.video_id = best.video_id
  base.url = pickUrlFromGroup(group)
  base.campaign_name = pickCampaignNameFromGroup(group) || best.campaign_name
  base.created_time = mergeEarliestCreatedTime(group) ?? best.created_time

  return {
    ...base,
    _count: group.length,
    campaignsCount: countUniqueIds(group, "campaign_id"),
    adsetsCount: countUniqueIds(group, "adset_id"),
    purchasesMale: gender.male,
    purchasesFemale: gender.female,
    purchasesUnknown: gender.unknown,
  }
}

function CountBadge({ value }: { value: number }) {
  return (
    <span className="inline-flex size-8 items-center justify-center rounded-full bg-muted text-sm font-semibold tabular-nums">
      {value}
    </span>
  )
}

function GenderPurchasesCell({
  count,
  percent,
  variant,
}: {
  count: number
  percent: number
  variant: "male" | "female"
}) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span
        className={cn(
          "text-lg font-bold tabular-nums",
          variant === "male" ? "text-blue-600" : "text-pink-600"
        )}
      >
        {count}
      </span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {percent}%
      </span>
    </div>
  )
}

function UrlCell({ row }: { row: MergedMetaCreativeRow }) {
  const url = row.url?.trim()
  if (!url) {
    return (
      <span className="text-sm italic text-muted-foreground">Sin URL</span>
    )
  }

  const path = formatLandingPagePath(url)
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-[200px] items-center gap-1 truncate text-sm text-blue-600 hover:underline"
      title={path}
    >
      <span className="truncate">{path}</span>
      <RiExternalLinkLine className="size-3.5 shrink-0" />
    </a>
  )
}

export function MetaCreativesTable({
  rows,
  currency = META_DASHBOARD_CURRENCY,
}: MetaCreativesTableProps) {
  const [sortKey, setSortKey] = React.useState<MetricKey>("spend")
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc")

  const grouped = React.useMemo(() => {
    const map = new Map<string, AdInsightRow[]>()
    for (const r of rows) {
      const k = getCreativeKey(r)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(r)
    }
    return Array.from(map.values()).map(mergeMetaCreativeGroup)
  }, [rows])

  const visibleGrouped = React.useMemo(
    () =>
      grouped.filter((row) =>
        passesTikTokCreativeSpendFilter(row.spend, currency)
      ),
    [grouped, currency]
  )

  const sorted = React.useMemo(() => {
    return [...visibleGrouped].sort((a, b) => {
      const va = getMetricValue(a, sortKey)
      const vb = getMetricValue(b, sortKey)
      return sortDir === "desc" ? vb - va : va - vb
    })
  }, [visibleGrouped, sortKey, sortDir])

  const totals = React.useMemo(() => {
    const totalSpend = visibleGrouped.reduce(
      (s, r) => s + (parseFloat(r.spend) || 0),
      0
    )
    const totalPurchases = visibleGrouped.reduce(
      (s, r) => s + extractPurchases(r),
      0
    )
    const totalMale = visibleGrouped.reduce((s, r) => s + r.purchasesMale, 0)
    const totalFemale = visibleGrouped.reduce((s, r) => s + r.purchasesFemale, 0)
    const totalUnknown = visibleGrouped.reduce(
      (s, r) => s + r.purchasesUnknown,
      0
    )
    const genderTotal = totalMale + totalFemale + totalUnknown

    return {
      spend: totalSpend,
      purchases: totalPurchases,
      cpa: totalPurchases > 0 ? totalSpend / totalPurchases : 0,
      male: totalMale,
      female: totalFemale,
      malePct: genderPurchasePercent(totalMale, genderTotal),
      femalePct: genderPurchasePercent(totalFemale, genderTotal),
    }
  }, [visibleGrouped])

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
            <TableHead className="w-[220px]">Creativo</TableHead>
            {META_CREATIVES_TABLE_METRICS.map((m) => (
              <TableHead
                key={m.key}
                className="cursor-pointer text-right transition-colors hover:text-foreground"
                onClick={() => handleSort(m.key)}
              >
                <div className="flex items-center justify-end gap-1">
                  {m.label}
                  {sortKey === m.key &&
                    (sortDir === "desc" ? (
                      <RiArrowDownLine className="size-3" />
                    ) : (
                      <RiArrowUpLine className="size-3" />
                    ))}
                </div>
              </TableHead>
            ))}
            <TableHead className="min-w-[160px]">URL</TableHead>
            <TableHead className="text-center">Campaña</TableHead>
            <TableHead className="text-center">Conjuntos</TableHead>
            <TableHead
              className="text-right"
              title={
                currency === TIKTOK_DASHBOARD_CURRENCY
                  ? "Estimado según reparto de gasto (audiencia TikTok)"
                  : undefined
              }
            >
              <span className="inline-flex items-center gap-1">
                <RiMenLine className="size-4 text-blue-600" />
                Hombres
                {currency === TIKTOK_DASHBOARD_CURRENCY ? (
                  <span className="text-[10px] font-normal text-muted-foreground">
                    ~
                  </span>
                ) : null}
              </span>
            </TableHead>
            <TableHead
              className="text-right"
              title={
                currency === TIKTOK_DASHBOARD_CURRENCY
                  ? "Estimado según reparto de gasto (audiencia TikTok)"
                  : undefined
              }
            >
              <span className="inline-flex items-center gap-1">
                <RiWomenLine className="size-4 text-pink-600" />
                Mujeres
                {currency === TIKTOK_DASHBOARD_CURRENCY ? (
                  <span className="text-[10px] font-normal text-muted-foreground">
                    ~
                  </span>
                ) : null}
              </span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row) => {
            const displayTitle = getCreativeCardDisplayTitle(row, currency)
            const genderTotal =
              row.purchasesMale + row.purchasesFemale + row.purchasesUnknown
            const malePct = genderPurchasePercent(row.purchasesMale, genderTotal)
            const femalePct = genderPurchasePercent(
              row.purchasesFemale,
              genderTotal
            )

            return (
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
                          {row.video_id ? (
                            <RiPlayCircleLine className="size-6 text-muted-foreground" />
                          ) : (
                            <RiImageLine className="size-6 text-muted-foreground" />
                          )}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-sm font-medium"
                        title={displayTitle}
                      >
                        {displayTitle}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row._count} anuncio{row._count === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                </TableCell>
                {META_CREATIVES_TABLE_METRICS.map((m) => (
                  <TableCell key={m.key} className="text-right tabular-nums">
                    {formatMetricValue(
                      getMetricValue(row, m.key),
                      m.key,
                      currency
                    )}
                  </TableCell>
                ))}
                <TableCell>
                  <UrlCell row={row} />
                </TableCell>
                <TableCell className="text-center">
                  <CountBadge value={row.campaignsCount} />
                </TableCell>
                <TableCell className="text-center">
                  <CountBadge value={row.adsetsCount} />
                </TableCell>
                <TableCell>
                  <GenderPurchasesCell
                    count={row.purchasesMale}
                    percent={malePct}
                    variant="male"
                  />
                </TableCell>
                <TableCell>
                  <GenderPurchasesCell
                    count={row.purchasesFemale}
                    percent={femalePct}
                    variant="female"
                  />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
        <TableFooter className="bg-muted/50 font-medium">
          <TableRow>
            <TableCell>Totales</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatMetricValue(totals.spend, "spend", currency)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatMetricValue(totals.purchases, "purchases", currency)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatMetricValue(totals.cpa, "cpa", currency)}
            </TableCell>
            <TableCell />
            <TableCell />
            <TableCell />
            <TableCell />
            <TableCell>
              <GenderPurchasesCell
                count={totals.male}
                percent={totals.malePct}
                variant="male"
              />
            </TableCell>
            <TableCell>
              <GenderPurchasesCell
                count={totals.female}
                percent={totals.femalePct}
                variant="female"
              />
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}
