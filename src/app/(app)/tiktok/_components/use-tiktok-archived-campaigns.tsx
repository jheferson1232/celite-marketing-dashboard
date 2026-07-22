"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { runServerAction } from "@/lib/server-action"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { RiArchiveLine, RiInboxUnarchiveLine } from "@remixicon/react"
import type { CampaignRow } from "@/lib/services/meta/types"
import {
  archiveTikTokCampaignAction,
  listArchivedTikTokCampaignsAction,
  unarchiveTikTokCampaignAction,
} from "../_actions/archived-campaigns"

export function useTikTokArchivedCampaigns() {
  const queryClient = useQueryClient()
  const [feedback, setFeedback] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  const archivedQuery = useQuery({
    queryKey: ["tiktok-archived-campaigns"],
    queryFn: () => runServerAction(listArchivedTikTokCampaignsAction()),
  })

  const archived = archivedQuery.data ?? []
  const archivedIds = useMemo(
    () => new Set((archivedQuery.data ?? []).map((item) => item.campaignId)),
    [archivedQuery.data]
  )

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["tiktok-archived-campaigns"] })

  const archiveMutation = useMutation({
    mutationFn: (campaign: CampaignRow) =>
      runServerAction(
        archiveTikTokCampaignAction({
          campaignId: campaign.id,
          name: campaign.name,
        })
      ),
    onSuccess: async (_data, campaign) => {
      setFeedback({
        type: "success",
        message: `«${campaign.name}» archivada en esta lista.`,
      })
      await invalidate()
    },
    onError: (error) => {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo archivar la campaña.",
      })
    },
  })

  const unarchiveMutation = useMutation({
    mutationFn: (campaignId: string) =>
      runServerAction(unarchiveTikTokCampaignAction(campaignId)),
    onSuccess: async () => {
      setFeedback({
        type: "success",
        message: "Campaña restaurada en la lista.",
      })
      await invalidate()
    },
    onError: (error) => {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo restaurar la campaña.",
      })
    },
  })

  const archivedMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0 gap-2">
          <RiArchiveLine className="h-4 w-4" />
          Archivados
          {archived.length > 0 ? (
            <Badge variant="secondary" className="h-5 min-w-5 px-1.5">
              {archived.length}
            </Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <DropdownMenuLabel className="px-3 py-2">
          Archivadas en esta lista
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {archivedQuery.isLoading ? (
          <div className="px-3 py-3">
            <Skeleton className="h-8 w-full" />
          </div>
        ) : archived.length === 0 ? (
          <p className="text-muted-foreground px-3 py-3 text-sm">
            No hay campañas archivadas.
          </p>
        ) : (
          <ul className="max-h-72 overflow-y-auto py-1">
            {archived.map((item) => (
              <li
                key={item.campaignId}
                className="flex items-center justify-between gap-2 px-3 py-2"
              >
                <span className="min-w-0 truncate text-sm font-medium">
                  {item.name}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={unarchiveMutation.isPending}
                  onClick={(e) => {
                    e.preventDefault()
                    unarchiveMutation.mutate(item.campaignId)
                  }}
                >
                  <RiInboxUnarchiveLine className="size-3.5" />
                  Restaurar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return {
    archivedIds,
    archivedMenu,
    feedback,
    isArchiving: archiveMutation.isPending,
    archiveCampaign: (campaign: CampaignRow) => {
      if (archiveMutation.isPending) return
      archiveMutation.mutate(campaign)
    },
  }
}
