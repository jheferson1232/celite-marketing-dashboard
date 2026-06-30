"use client"

import Link from "next/link"
import { useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { CAMPAIGN_STATUS_VALUES } from "@/lib/campaigns/status"
import type { CampaignStatus } from "@/lib/campaigns/status"
import { Input } from "@/components/ui/input"
import { runServerAction } from "@/lib/server-action"
import { cn } from "@/lib/utils"
import { listTikTokPixelsAction } from "../_actions/campaigns"
import {
  CAMPAIGN_STATUS_BADGE_CLASS,
  CAMPAIGN_STATUS_LABELS,
} from "../_lib/status-labels"

type TikTokPixelOption = {
  id: string
  name: string
  code: string | null
}

interface CampaignGeneralSectionProps {
  name: string
  status: CampaignStatus
  pixelId: string
  disabled?: boolean
  onNameChange: (name: string) => void
  onStatusChange: (status: CampaignStatus) => void
  onPixelIdChange: (pixelId: string) => void
}

function buildPixelOptions(
  pixels: TikTokPixelOption[],
  selectedPixelId: string
): TikTokPixelOption[] {
  const byId = new Map(pixels.map((pixel) => [pixel.id, pixel]))

  if (selectedPixelId && !byId.has(selectedPixelId)) {
    byId.set(selectedPixelId, {
      id: selectedPixelId,
      name: `Pixel guardado (${selectedPixelId.slice(-6)})`,
      code: null,
    })
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "es"))
}

export function CampaignGeneralSection({
  name,
  status,
  pixelId,
  disabled = false,
  onNameChange,
  onStatusChange,
  onPixelIdChange,
}: CampaignGeneralSectionProps) {
  const {
    data: pixels = [],
    isLoading: pixelsLoading,
    isError: pixelsError,
    error: pixelsErrorDetail,
  } = useQuery({
    queryKey: ["tiktok-pixels"],
    queryFn: () => runServerAction(listTikTokPixelsAction()),
    staleTime: 5 * 60 * 1000,
  })

  const pixelOptions = useMemo(
    () => buildPixelOptions(pixels, pixelId),
    [pixelId, pixels]
  )

  useEffect(() => {
    if (pixelId || pixelOptions.length === 0) return
    onPixelIdChange(pixelOptions[0]!.id)
  }, [onPixelIdChange, pixelId, pixelOptions])

  const selectedPixel = pixelOptions.find((pixel) => pixel.id === pixelId)

  return (
    <section className="max-w-2xl space-y-4 rounded-xl border bg-muted/10 p-4">
      <div>
        <h2 className="text-sm font-semibold">Información general</h2>
        <p className="text-xs text-muted-foreground">
          Nombre, pixel de TikTok Ads y estado de la campaña.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="campaign-name" className="text-sm font-medium">
          Nombre de la campaña
        </label>
        <Input
          id="campaign-name"
          value={name}
          disabled={disabled}
          onChange={(event) => onNameChange(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <label htmlFor="campaign-tiktok-pixel" className="text-sm font-medium">
            Pixel de TikTok Ads
          </label>
          {pixelOptions.length > 0 ? (
            <span className="text-muted-foreground text-xs">
              {pixelOptions.length} pixel{pixelOptions.length === 1 ? "" : "es"} en la
              cuenta
            </span>
          ) : null}
        </div>
        {pixelsLoading ? (
          <p className="text-muted-foreground text-sm">Cargando pixels…</p>
        ) : pixelsError ? (
          <p className="text-sm text-destructive">
            {pixelsErrorDetail instanceof Error
              ? pixelsErrorDetail.message
              : "No se pudieron cargar los pixels"}
          </p>
        ) : pixelOptions.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No hay pixels en la cuenta conectada.{" "}
            <Link
              href="/tiktok/cuentas"
              className="text-primary underline-offset-4 hover:underline"
            >
              Conectar cuenta
            </Link>
          </p>
        ) : (
          <select
            id="campaign-tiktok-pixel"
            className={cn(
              "border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm shadow-xs",
              "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
            value={pixelId}
            disabled={disabled}
            onChange={(event) => onPixelIdChange(event.target.value)}
          >
            <option value="" disabled>
              Seleccioná un pixel
            </option>
            {pixelOptions.map((pixel) => (
              <option key={pixel.id} value={pixel.id}>
                {pixel.name}
              </option>
            ))}
          </select>
        )}
        <p className="text-xs text-muted-foreground">
          {selectedPixel ? (
            <>
              <span className="text-foreground font-medium">{selectedPixel.name}</span>
              {" · "}
              ID {selectedPixel.id}
            </>
          ) : (
            "Seleccioná el pixel que recibe eventos de compra en tu landing."
          )}
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="campaign-status" className="text-sm font-medium">
          Status
        </label>
        <select
          id="campaign-status"
          className={cn(
            "border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm shadow-xs",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
          value={status}
          disabled={disabled}
          onChange={(event) => onStatusChange(event.target.value as CampaignStatus)}
        >
          {CAMPAIGN_STATUS_VALUES.map((value) => (
            <option key={value} value={value}>
              {CAMPAIGN_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Estado actual:{" "}
          <span className={cn("font-medium", CAMPAIGN_STATUS_BADGE_CLASS[status])}>
            {CAMPAIGN_STATUS_LABELS[status]}
          </span>
        </p>
      </div>
    </section>
  )
}
