"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { RiPriceTag3Line } from "@remixicon/react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { runServerAction } from "@/lib/server-action"
import { cn } from "@/lib/utils"
import {
  CAMPAIGN_ORIGINS,
  CAMPAIGN_ORIGIN_LABELS,
  type CampaignOriginPlatform,
  type CampaignOriginValue,
} from "@/lib/services/campaign-origin.shared"
import { listMetaCampaignOriginsAction } from "@/app/(app)/dashboard/_actions/campaign-origin"
import { listTikTokCampaignOriginsAction } from "@/app/(app)/tiktok/_actions/campaign-origin"

const ORIGINS_QUERY_KEY: Record<CampaignOriginPlatform, readonly string[]> = {
  tiktok: ["tiktok-campaign-origins"],
  meta: ["meta-campaign-origins"],
}

export type OriginFilterValue = CampaignOriginValue | "untagged"

/** @deprecated Usar OriginFilterValue */
export type TikTokOriginFilterValue = OriginFilterValue

interface CampaignOriginFilterProps {
  platform: CampaignOriginPlatform
  campaignIds: string[]
  selectedOrigins: Set<OriginFilterValue>
  onSelectedOriginsChange: (next: Set<OriginFilterValue>) => void
}

async function listOrigins(platform: CampaignOriginPlatform) {
  return platform === "meta"
    ? runServerAction(listMetaCampaignOriginsAction())
    : runServerAction(listTikTokCampaignOriginsAction())
}

export function CampaignOriginFilter({
  platform,
  campaignIds,
  selectedOrigins,
  onSelectedOriginsChange,
}: CampaignOriginFilterProps) {
  const originsQuery = useQuery({
    queryKey: ORIGINS_QUERY_KEY[platform],
    queryFn: () => listOrigins(platform),
    staleTime: 60_000,
  })

  const originByCampaignId = React.useMemo(() => {
    const map = new Map<string, CampaignOriginValue>()
    for (const row of originsQuery.data ?? []) {
      map.set(row.campaignId, row.origin)
    }
    return map
  }, [originsQuery.data])

  const counts = React.useMemo(() => {
    const next: Record<OriginFilterValue, number> = {
      ia: 0,
      reutilizado: 0,
      untagged: 0,
    }
    for (const campaignId of campaignIds) {
      const origin = originByCampaignId.get(campaignId)
      if (origin) next[origin] += 1
      else next.untagged += 1
    }
    return next
  }, [campaignIds, originByCampaignId])

  const selectedCount = selectedOrigins.size
  const hasSelection = selectedCount > 0

  const toggle = (value: OriginFilterValue, checked: boolean) => {
    const next = new Set(selectedOrigins)
    if (checked) next.add(value)
    else next.delete(value)
    onSelectedOriginsChange(next)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("shrink-0 gap-2", hasSelection && "border-primary/50")}
        >
          <RiPriceTag3Line className="size-4" />
          Origen
          {hasSelection ? (
            <span className="bg-primary text-primary-foreground rounded-md px-1.5 text-[10px] font-semibold">
              {selectedCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Filtrar por origen</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {originsQuery.isLoading ? (
          <p className="text-muted-foreground px-2 py-1.5 text-xs">
            Cargando…
          </p>
        ) : (
          <>
            {CAMPAIGN_ORIGINS.map((origin) => (
              <DropdownMenuCheckboxItem
                key={origin}
                checked={selectedOrigins.has(origin)}
                onCheckedChange={(checked) =>
                  toggle(origin, Boolean(checked))
                }
                onSelect={(event) => event.preventDefault()}
              >
                <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <span>{CAMPAIGN_ORIGIN_LABELS[origin]}</span>
                  <span className="text-muted-foreground shrink-0 text-[10px]">
                    {counts[origin]}
                  </span>
                </span>
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuCheckboxItem
              checked={selectedOrigins.has("untagged")}
              onCheckedChange={(checked) =>
                toggle("untagged", Boolean(checked))
              }
              onSelect={(event) => event.preventDefault()}
            >
              <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <span>Sin etiqueta</span>
                <span className="text-muted-foreground shrink-0 text-[10px]">
                  {counts.untagged}
                </span>
              </span>
            </DropdownMenuCheckboxItem>
          </>
        )}
        {hasSelection ? (
          <>
            <DropdownMenuSeparator />
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground w-full px-2 py-1.5 text-left text-xs"
              onClick={() => onSelectedOriginsChange(new Set())}
            >
              Quitar filtro
            </button>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** null = sin filtro; Set = campañas que coinciden con orígenes seleccionados. */
export function useCampaignIdsForSelectedOrigins(
  platform: CampaignOriginPlatform,
  selectedOrigins: Set<OriginFilterValue>,
  campaignIds: string[]
): Set<string> | null {
  const originsQuery = useQuery({
    queryKey: ORIGINS_QUERY_KEY[platform],
    queryFn: () => listOrigins(platform),
    staleTime: 60_000,
    enabled: selectedOrigins.size > 0,
  })

  return React.useMemo(() => {
    if (selectedOrigins.size === 0) return null

    const originByCampaignId = new Map<string, CampaignOriginValue>()
    for (const row of originsQuery.data ?? []) {
      originByCampaignId.set(row.campaignId, row.origin)
    }

    const matched = new Set<string>()
    for (const campaignId of campaignIds) {
      const origin = originByCampaignId.get(campaignId)
      if (origin) {
        if (selectedOrigins.has(origin)) matched.add(campaignId)
      } else if (selectedOrigins.has("untagged")) {
        matched.add(campaignId)
      }
    }
    return matched
  }, [campaignIds, originsQuery.data, selectedOrigins])
}
