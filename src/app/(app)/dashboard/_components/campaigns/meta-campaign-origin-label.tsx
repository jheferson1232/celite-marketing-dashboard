"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { RiPriceTag3Line } from "@remixicon/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { runServerAction } from "@/lib/server-action"
import {
  CAMPAIGN_ORIGINS,
  CAMPAIGN_ORIGIN_LABELS,
  type CampaignOriginValue,
} from "@/lib/services/campaign-origin.shared"
import {
  listMetaCampaignOriginsAction,
  setMetaCampaignOriginAction,
} from "../../_actions/campaign-origin"

export const META_ORIGINS_QUERY_KEY = ["meta-campaign-origins"] as const

const ORIGIN_BADGE_CLASS: Record<CampaignOriginValue, string> = {
  ia: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  reutilizado:
    "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
}

export function MetaCampaignOriginLabel({
  campaignId,
}: {
  campaignId: string
}) {
  const queryClient = useQueryClient()

  const originsQuery = useQuery({
    queryKey: META_ORIGINS_QUERY_KEY,
    queryFn: () => runServerAction(listMetaCampaignOriginsAction()),
    staleTime: 60_000,
  })

  const current = originsQuery.data?.find(
    (row) => row.campaignId === campaignId
  )?.origin

  const mutation = useMutation({
    mutationFn: (origin: CampaignOriginValue | null) =>
      runServerAction(setMetaCampaignOriginAction({ campaignId, origin })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: META_ORIGINS_QUERY_KEY })
    },
  })

  const label = current ? CAMPAIGN_ORIGIN_LABELS[current] : null

  return (
    <div
      className="shrink-0"
      onClick={(event) => event.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={cn(
              "shrink-0",
              label ? "h-6 w-auto px-1.5" : "size-6"
            )}
            disabled={mutation.isPending}
            aria-label={
              label
                ? `Origen: ${label}. Cambiar etiqueta`
                : "Elegir etiqueta IA o Reutilizado"
            }
            title={
              label
                ? `Origen: ${label}`
                : "Etiqueta: IA o Reutilizado"
            }
          >
            {label && current ? (
              <Badge
                variant="outline"
                className={cn(
                  "px-1.5 py-0 text-[10px] font-medium",
                  ORIGIN_BADGE_CLASS[current]
                )}
              >
                {label}
              </Badge>
            ) : (
              <RiPriceTag3Line className="text-muted-foreground size-3.5" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuLabel>Origen creativo</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {CAMPAIGN_ORIGINS.map((origin) => (
            <DropdownMenuItem
              key={origin}
              disabled={mutation.isPending || current === origin}
              onClick={() => mutation.mutate(origin)}
            >
              {CAMPAIGN_ORIGIN_LABELS[origin]}
            </DropdownMenuItem>
          ))}
          {current ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={mutation.isPending}
                onClick={() => mutation.mutate(null)}
              >
                Quitar etiqueta
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
