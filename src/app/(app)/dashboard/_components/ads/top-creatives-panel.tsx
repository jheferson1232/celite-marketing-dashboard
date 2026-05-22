"use client"

import * as React from "react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import {
  RiAddLine,
  RiPlayCircleLine,
  RiImageLine,
  RiExternalLinkLine,
} from "@remixicon/react"
import {
  formatLandingPagePath,
  META_DASHBOARD_CURRENCY,
  type CurrencyCode,
} from "@/lib/format"
import type { AdInsightRow } from "@/lib/services/meta/types"
import {
  MetricKey,
  METRIC_OPTIONS,
  META_CREATIVES_TABLE_METRICS,
  getMetricValue,
  formatMetricValue,
  getCreativeKey,
  mergeEarliestCreatedTime,
  getCreativeCardDisplayTitle,
  pickAdsetNamesFromGroup,
  pickCampaignNameFromGroup,
  pickHighestSpendRow,
  pickUrlFromGroup,
  passesTikTokCreativeSpendFilter,
} from "./utils"
import { CreativePreviewDialog } from "./creative-preview-dialog"
import { CreativePreviewImage } from "./creative-preview-image"

interface TopCreativesPanelProps {
  rows: AdInsightRow[]
  currency?: CurrencyCode
}

function mergeRows(group: AdInsightRow[]): AdInsightRow {
  const base = { ...group[0] }
  const spend = group.reduce((s, r) => s + (parseFloat(r.spend) || 0), 0)
  const impressions = group.reduce(
    (s, r) => s + (parseFloat(r.impressions) || 0),
    0
  )
  const clicks = group.reduce((s, r) => s + (parseFloat(r.clicks) || 0), 0)
  const reach = group.reduce((s, r) => s + (parseFloat(r.reach) || 0), 0)

  base.spend = String(spend)
  base.impressions = String(impressions)
  base.clicks = String(clicks)
  base.reach = String(reach)
  base.ctr = impressions > 0 ? String((clicks / impressions) * 100) : "0"
  base.cpc = clicks > 0 ? String(spend / clicks) : "0"
  base.cpm = impressions > 0 ? String((spend / impressions) * 1000) : "0"

  // Merge actions
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

  if (actionMap.size > 0) {
    base.actions = Array.from(actionMap.entries()).map(([type, val]) => ({
      action_type: type,
      value: String(val),
    }))
  }
  if (actionValueMap.size > 0) {
    base.action_values = Array.from(actionValueMap.entries()).map(
      ([type, val]) => ({
        action_type: type,
        value: String(val),
      })
    )
  }
  if (costMap.size > 0) {
    base.cost_per_action_type = Array.from(costMap.entries()).map(
      ([type, val]) => ({
        action_type: type,
        value: String(val / group.length),
      })
    )
  }

  const best = pickHighestSpendRow(group)
  base.ad_id = best.ad_id
  base.ad_name = best.ad_name
  base.thumbnail_url = best.thumbnail_url
  base.image_url = best.image_url
  base.video_url = best.video_url
  base.video_id = best.video_id
  base.url = pickUrlFromGroup(group)
  base.campaign_name = pickCampaignNameFromGroup(group) || best.campaign_name
  base.adset_name = pickAdsetNamesFromGroup(group) || best.adset_name
  base.created_time = mergeEarliestCreatedTime(group) ?? best.created_time

  return base
}

function CreativeCard({
  creativeKey,
  row,
  metrics,
  metricOptions,
  currency,
  adsCount,
}: {
  creativeKey: string
  row: AdInsightRow
  metrics: MetricKey[]
  metricOptions: { key: MetricKey; label: string }[]
  currency: CurrencyCode
  adsCount: number
}) {
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false)
  const hasVideo = !!row.video_id
  const displayTitle = getCreativeCardDisplayTitle(row, currency)

  // We need to adapt AdInsightRow to CreativeRow for CreativePreviewDialog
  const creativeRowAdapter = {
    id: creativeKey,
    adId: row.ad_id,
    name: displayTitle,
    thumbnailUrl: row.thumbnail_url,
    imageUrl: row.image_url || row.thumbnail_url,
    videoId: row.video_id,
    videoUrl: row.video_url,
    mediaType: (hasVideo ? "video" : "image") as "video" | "image",
    totalSpend: parseFloat(row.spend),
    impressions: parseInt(row.impressions),
    cpa: 0, // Not used in dialog
    ctr: parseFloat(row.ctr),
    frequency: parseFloat(row.frequency),
    adsCount: adsCount,
  }

  return (
    <>
      <Card className="gap-0 overflow-hidden pt-0 shadow-none ring-1 ring-foreground/10">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className="group block w-full cursor-pointer transition-opacity hover:opacity-90"
          >
            <CreativePreviewImage
              thumbnailUrl={row.thumbnail_url}
              imageUrl={row.image_url}
              alt={displayTitle}
              className="aspect-9/16 w-full"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
              <div className="rounded-full bg-black/50 p-3 text-white backdrop-blur-sm">
                {hasVideo ? (
                  <RiPlayCircleLine className="size-8" />
                ) : (
                  <RiImageLine className="size-8" />
                )}
              </div>
            </div>
          </button>
          <Badge
            variant="secondary"
            className="pointer-events-none absolute bottom-2 left-2 bg-black/70 text-white backdrop-blur-sm"
          >
            {hasVideo ? "Video" : "Imagen"}
          </Badge>
        </div>

        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <p className="truncate text-sm font-semibold" title={displayTitle}>
              {displayTitle}
            </p>
            <p className="text-xs text-muted-foreground">
              {adsCount} anuncio{adsCount === 1 ? "" : "s"}
            </p>
          </div>

          {row.url && (
            <a
              href={row.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 truncate text-xs text-blue-500 hover:underline"
              title={formatLandingPagePath(row.url)}
            >
              {formatLandingPagePath(row.url)}
              <RiExternalLinkLine className="size-3 shrink-0" />
            </a>
          )}

          <dl className="space-y-2">
            {metrics.map((metric) => (
              <div
                key={metric}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <dt className="text-muted-foreground">
                  {metricOptions.find((m) => m.key === metric)?.label}
                </dt>
                <dd className="shrink-0 whitespace-nowrap font-medium tabular-nums">
                  {formatMetricValue(
                    getMetricValue(row, metric),
                    metric,
                    currency
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <CreativePreviewDialog
        creative={creativeRowAdapter}
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
      />
    </>
  )
}

export function TopCreativesPanel({
  rows,
  currency = META_DASHBOARD_CURRENCY,
}: TopCreativesPanelProps) {
  const metricOptions =
    currency === META_DASHBOARD_CURRENCY
      ? META_CREATIVES_TABLE_METRICS
      : METRIC_OPTIONS

  const [selectedMetrics, setSelectedMetrics] = React.useState<MetricKey[]>([
    "spend",
    "created_at",
    "purchases",
    "cpa",
  ])

  const groupedRows = React.useMemo(() => {
    const map = new Map<string, AdInsightRow[]>()
    for (const row of rows) {
      const key = getCreativeKey(row)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(row)
    }
    return Array.from(map.entries()).map(([key, group]) => ({
      key,
      merged: mergeRows(group),
      count: group.length,
    }))
  }, [rows])

  const primaryMetric = selectedMetrics[0] || "spend"
  const visibleGroups = React.useMemo(
    () =>
      groupedRows.filter((g) =>
        passesTikTokCreativeSpendFilter(g.merged.spend, currency)
      ),
    [groupedRows, currency]
  )

  const sortedRows = React.useMemo(() => {
    return [...visibleGroups].sort(
      (a, b) =>
        getMetricValue(b.merged, primaryMetric) -
        getMetricValue(a.merged, primaryMetric)
    )
  }, [visibleGroups, primaryMetric])

  const toggleMetric = (key: MetricKey) => {
    setSelectedMetrics((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev
        return prev.filter((m) => m !== key)
      }
      if (prev.length >= 4) return prev
      return [...prev, key]
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <RiAddLine className="size-4" />
                Métricas
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <div className="space-y-1">
                <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Seleccionar métricas (máx. 4)
                </p>
                {metricOptions.map((opt) => {
                  const isActive = selectedMetrics.includes(opt.key)
                  return (
                    <div
                      key={opt.key}
                      className="flex items-center space-x-2 rounded-md px-2 py-1.5 hover:bg-muted"
                    >
                      <Checkbox
                        id={`metric-${opt.key}`}
                        checked={isActive}
                        onCheckedChange={() => toggleMetric(opt.key)}
                      />
                      <label
                        htmlFor={`metric-${opt.key}`}
                        className="flex flex-1 cursor-pointer text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {opt.label}
                      </label>
                    </div>
                  )
                })}
              </div>
            </PopoverContent>
          </Popover>

          <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-1">
            {selectedMetrics.map((metric, idx) => (
              <Badge
                key={metric}
                variant="secondary"
                className="gap-1 bg-background shadow-none"
              >
                <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                  {idx + 1}
                </span>
                {metricOptions.find((m) => m.key === metric)?.label}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">
            Ordenado por:{" "}
            <strong>
              {metricOptions.find((m) => m.key === primaryMetric)?.label}
            </strong>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
        {sortedRows.map(({ key, merged, count }) => (
          <CreativeCard
            key={key}
            creativeKey={key}
            row={merged}
            metrics={selectedMetrics}
            metricOptions={metricOptions}
            currency={currency}
            adsCount={count}
          />
        ))}
      </div>
    </div>
  )
}
