"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { formatCurrency } from "@/lib/format"
import type { CreativeRow } from "@/lib/services/meta/types"
import { RiImageLine, RiPlayCircleLine } from "@remixicon/react"
import { CreativePreviewDialog } from "./creative-preview-dialog"
import { CreativePreviewImage } from "./creative-preview-image"

const DASHBOARD_CURRENCY = "COP" as const

interface AdCreativeCardProps {
  creative: CreativeRow
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-ES").format(value)
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`
}

function formatFrequency(value: number) {
  return value.toFixed(2)
}

function CreativeThumbnail({ creative }: AdCreativeCardProps) {
  if (creative.thumbnailUrl || creative.imageUrl) {
    return (
      <CreativePreviewImage
        thumbnailUrl={creative.thumbnailUrl}
        imageUrl={creative.imageUrl}
        alt={creative.name}
        className="aspect-9/16 w-full"
      />
    )
  }

  return (
    <div className="flex aspect-9/16 w-full items-center justify-center bg-muted">
      {creative.mediaType === "video" ? (
        <RiPlayCircleLine className="size-10 text-muted-foreground" />
      ) : (
        <RiImageLine className="size-10 text-muted-foreground" />
      )}
    </div>
  )
}

export function AdCreativeCard({ creative }: AdCreativeCardProps) {
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false)

  const metrics = [
    {
      label: "Gasto total",
      value: formatCurrency(creative.totalSpend, DASHBOARD_CURRENCY),
    },
    {
      label: "Impresiones",
      value: formatNumber(creative.impressions),
    },
    {
      label: "CPA",
      value:
        creative.cpa > 0
          ? formatCurrency(creative.cpa, DASHBOARD_CURRENCY)
          : "—",
    },
    {
      label: "CTR",
      value: formatPercent(creative.ctr),
    },
    {
      label: "Frecuencia",
      value: formatFrequency(creative.frequency),
    },
  ]

  return (
    <>
      <Card className="gap-0 overflow-hidden py-0 shadow-none ring-1 ring-foreground/10">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className="block w-full cursor-pointer transition-opacity hover:opacity-90"
            aria-label={`Ver preview de ${creative.name}`}
          >
            <CreativeThumbnail creative={creative} />
          </button>
          <Badge
            variant="secondary"
            className="pointer-events-none absolute bottom-2 left-2 bg-black/70 text-white backdrop-blur-sm"
          >
            {creative.mediaType === "video" ? "Video" : "Imagen"}
          </Badge>
        </div>

        <CardContent className="px-4 py-4">
          <div>
            <p className="truncate text-sm font-semibold">{creative.name}</p>
            <p className="text-xs text-muted-foreground">
              {creative.adsCount} anuncio{creative.adsCount === 1 ? "" : "s"}
            </p>
          </div>

          <dl className="space-y-2">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <dt className="text-muted-foreground">{metric.label}</dt>
                <dd className="font-medium tabular-nums">{metric.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>

        <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground">
          ID: {creative.id}
        </CardFooter>
      </Card>

      <CreativePreviewDialog
        creative={creative}
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
      />
    </>
  )
}
