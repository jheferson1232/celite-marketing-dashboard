"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { runServerAction } from "@/lib/server-action"
import { formatCurrency } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import {
  RiArchiveLine,
  RiHistoryLine,
  RiInboxUnarchiveLine,
} from "@remixicon/react"
import { CampaignsTable } from "@/app/(app)/dashboard/_components/campaigns"
import {
  TIKTOK_CAMPAIGNS_DEFAULT_COLUMN_VISIBILITY,
} from "@/app/(app)/dashboard/_components/campaigns/use-persisted-column-visibility"
import type { CampaignRow } from "@/lib/services/meta/types"
import { TikTokManageProvider } from "@/app/(app)/tiktok/_components/tiktok-manage-provider"
import { useTikTokDashboardAccount } from "@/app/(app)/tiktok/_components/use-tiktok-dashboard-account"
import { resolveTikTokAccountCurrency } from "@/lib/services/tiktok/account-currency"
import {
  archiveRecoverableCampaignAction,
  listArchivedRecoverableCampaignsAction,
  listTikTokPausedRecoverableAction,
  unarchiveRecoverableCampaignAction,
} from "../_actions/tiktok-agent"

const PAUSED_RECOVERABLE_COLUMN_VISIBILITY_KEY =
  "tiktok-agente:paused-recoverable:column-visibility"

export function TikTokAgentePausedRecoverableCard() {
  const queryClient = useQueryClient()
  const { accountId, selectedAccount } = useTikTokDashboardAccount()
  const accountCurrency = resolveTikTokAccountCurrency(
    selectedAccount?.currency
  )

  const [archiveFeedback, setArchiveFeedback] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  const query = useQuery({
    queryKey: ["tiktok-paused-recoverable"],
    queryFn: () => runServerAction(listTikTokPausedRecoverableAction()),
    refetchInterval: 60_000,
  })

  const archivedQuery = useQuery({
    queryKey: ["tiktok-paused-recoverable-archived"],
    queryFn: () => runServerAction(listArchivedRecoverableCampaignsAction()),
  })

  const campaigns = query.data?.campaigns ?? []
  const adSetsByCampaignId = query.data?.adSetsByCampaignId ?? {}
  const criticoCpaPen = query.data?.criticoCpaPen
  const maxTotalCpaPen = query.data?.maxTotalCpaPen ?? 50
  const archived = archivedQuery.data ?? []

  const invalidateLists = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["tiktok-paused-recoverable"] }),
      queryClient.invalidateQueries({
        queryKey: ["tiktok-paused-recoverable-archived"],
      }),
    ])
  }

  const archiveMutation = useMutation({
    mutationFn: (campaign: CampaignRow) =>
      runServerAction(
        archiveRecoverableCampaignAction({
          campaignId: campaign.id,
          name: campaign.name,
        })
      ),
    onSuccess: async (_data, campaign) => {
      setArchiveFeedback({
        type: "success",
        message: `«${campaign.name}» archivada en esta lista.`,
      })
      await invalidateLists()
    },
    onError: (error) => {
      setArchiveFeedback({
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
      runServerAction(unarchiveRecoverableCampaignAction(campaignId)),
    onSuccess: async () => {
      setArchiveFeedback({
        type: "success",
        message: "Campaña restaurada en la lista.",
      })
      await invalidateLists()
    },
    onError: (error) => {
      setArchiveFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo restaurar la campaña.",
      })
    },
  })

  const pausedCount = useMemo(() => {
    const nestedAdsets = Object.values(adSetsByCampaignId).reduce(
      (sum, list) => sum + list.length,
      0
    )
    const pausedCampaigns = campaigns.filter((c) => c.status === "PAUSED").length
    return pausedCampaigns + nestedAdsets
  }, [campaigns, adSetsByCampaignId])

  const archivedButton = (
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <RiHistoryLine className="text-muted-foreground size-4" />
              Pausados con buen historial
            </CardTitle>
            <CardDescription>
              Campañas con conjuntos apagados (o campañas apagadas) que ya
              tuvieron ventas. CPA total ≤{" "}
              {formatCurrency(maxTotalCpaPen, "PEN")}. Hacé clic en (+) para
              ver conjuntos; el ícono de archivo saca la campaña de esta lista
              (p. ej. sin stock). Revisá archivadas con el botón «Archivados».
              {criticoCpaPen != null ? (
                <>
                  {" "}
                  CPA total &lt; {formatCurrency(criticoCpaPen, "PEN")} → buen
                  historial.
                </>
              ) : null}
            </CardDescription>
          </div>
          {pausedCount > 0 ? (
            <Badge variant="secondary">{pausedCount}</Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-0 sm:px-0">
        {archiveFeedback ? (
          <p
            className={
              archiveFeedback.type === "error"
                ? "text-destructive px-6 text-sm"
                : "px-6 text-sm text-emerald-700 dark:text-emerald-400"
            }
          >
            {archiveFeedback.message}
          </p>
        ) : null}
        {query.isLoading ? (
          <div className="px-6">
            <Skeleton className="h-40 w-full" />
          </div>
        ) : query.isError ? (
          <p className="text-destructive px-6 text-sm">
            {query.error instanceof Error
              ? query.error.message
              : "No se pudo cargar la lista."}
          </p>
        ) : campaigns.length === 0 ? (
          <div className="space-y-3 px-6">
            <div className="flex justify-end">{archivedButton}</div>
            <p className="text-muted-foreground text-sm">
              No hay campañas ni conjuntos apagados con compras acumuladas.
            </p>
          </div>
        ) : (
          <TikTokManageProvider
            accountId={accountId}
            currency={accountCurrency}
          >
            <div className="px-2 sm:px-4">
              <CampaignsTable
                key={accountId ?? "paused-recoverable"}
                data={campaigns}
                isLoading={false}
                currency={accountCurrency}
                enableTikTokManage
                showAllCampaignsFilter
                tikTokAdSetsByCampaignId={adSetsByCampaignId}
                adSetsQueryKeyPrefix="tiktok-paused-recoverable-adsets"
                columnVisibilityStorageKey={
                  PAUSED_RECOVERABLE_COLUMN_VISIBILITY_KEY
                }
                defaultColumnVisibility={
                  TIKTOK_CAMPAIGNS_DEFAULT_COLUMN_VISIBILITY
                }
                toolbarExtra={archivedButton}
                onArchiveCampaign={(campaign) => {
                  if (
                    archiveMutation.isPending ||
                    !window.confirm(
                      `¿Sacar «${campaign.name}» de esta lista?\nNo se pausa en TikTok; solo se oculta aquí (útil si no hay stock).`
                    )
                  ) {
                    return
                  }
                  archiveMutation.mutate(campaign)
                }}
              />
            </div>
          </TikTokManageProvider>
        )}
      </CardContent>
    </Card>
  )
}
