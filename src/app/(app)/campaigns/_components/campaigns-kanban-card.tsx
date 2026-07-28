"use client"

import Link from "next/link"
import { useState } from "react"
import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { RiDeleteBinLine } from "@remixicon/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/format"
import { formatDayMonth } from "@/lib/date"
import {
  CAMPAIGN_OUTCOME_MIN_SPEND_PEN,
  canDeleteCampaign,
} from "@/lib/campaigns/status"
import { runServerAction } from "@/lib/server-action"
import { cn } from "@/lib/utils"
import type { CampaignKanbanRecord } from "@/lib/services/campaign-kanban-outcomes"
import { deleteCampaignAction } from "../_actions/campaigns"
import { CampaignDeleteDialog } from "./campaign-delete-dialog"

interface CampaignsKanbanCardProps {
  campaign: CampaignKanbanRecord
  isDragging?: boolean
}

function formatUpdatedAt(date: Date) {
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}

export function CampaignKanbanCardView({
  campaign,
  isDragging = false,
  onDeleteClick,
}: CampaignsKanbanCardProps & {
  onDeleteClick?: () => void
}) {
  const metrics = campaign.metrics
  const spend = metrics?.totalSpend ?? 0
  const purchases = metrics?.totalPurchases ?? 0
  const cpa = metrics?.totalCpa ?? 0
  const belowMinSpend =
    campaign.status === "running" && spend < CAMPAIGN_OUTCOME_MIN_SPEND_PEN
  const showDelete = Boolean(onDeleteClick)

  return (
    <div
      className={cn(
        "flex w-full items-stretch overflow-hidden rounded-lg border border-border bg-background transition",
        isDragging && "opacity-60 ring-2 ring-primary/30 shadow-md"
      )}
    >
      <div
        className="relative flex h-16 w-16 shrink-0 cursor-grab items-center justify-center bg-muted/40 active:cursor-grabbing"
        aria-label={`Arrastrar ${campaign.name}`}
      >
        <span className="text-xs font-semibold text-muted-foreground">
          {campaign.strategy}
        </span>
      </div>

      <Link
        href={`/campaigns/${campaign.id}`}
        onPointerDown={(event) => event.stopPropagation()}
        className={cn(
          "flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-2.5 py-2",
          "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-sm font-semibold leading-tight">
            {campaign.name}
          </p>
          <Badge
            variant="outline"
            className="shrink-0 border-sky-500/40 bg-sky-500/10 px-1.5 py-0 text-[10px] font-medium text-sky-700 dark:text-sky-300"
            title={`Publicada desde Campaigns · ${formatDayMonth(campaign.createdAt)}`}
          >
            {formatDayMonth(campaign.createdAt)}
          </Badge>
        </div>
        <p className="truncate text-[11px] text-muted-foreground">
          {campaign.config.adgroups.length} conjuntos ·{" "}
          {formatUpdatedAt(campaign.updatedAt)}
        </p>
        {metrics ? (
          <p className="truncate text-[11px] text-muted-foreground">
            {formatCurrency(spend, "PEN")} · {purchases} ventas
            {cpa > 0 ? ` · CPA ${formatCurrency(cpa, "PEN")}` : ""}
            {belowMinSpend
              ? ` · falta ${formatCurrency(CAMPAIGN_OUTCOME_MIN_SPEND_PEN - spend, "PEN")} p/ clasificar`
              : ""}
          </p>
        ) : null}
      </Link>

      {showDelete ? (
        <div className="flex shrink-0 items-center pr-1.5">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 text-muted-foreground hover:text-destructive"
            aria-label={`Eliminar ${campaign.name}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onDeleteClick?.()
            }}
          >
            <RiDeleteBinLine className="size-4" />
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export function CampaignsKanbanCard({
  campaign,
  isDragging = false,
}: CampaignsKanbanCardProps) {
  const queryClient = useQueryClient()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: campaign.id,
    data: { campaign, status: campaign.status },
  })

  const deleteMutation = useMutation({
    mutationFn: async () =>
      runServerAction(deleteCampaignAction(campaign.id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["campaigns"] })
      void queryClient.invalidateQueries({ queryKey: ["campaigns-kanban"] })
      setDeleteOpen(false)
    },
  })

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

  const showDelete = canDeleteCampaign(campaign.status)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "opacity-40")}
    >
      <div {...listeners} {...attributes}>
        <CampaignKanbanCardView
          campaign={campaign}
          onDeleteClick={showDelete ? () => setDeleteOpen(true) : undefined}
        />
      </div>

      {showDelete ? (
        <CampaignDeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          campaignName={campaign.name}
          isPending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate()}
        />
      ) : null}

      {deleteMutation.isError ? (
        <p className="mt-1 px-1 text-[11px] text-destructive">
          {deleteMutation.error instanceof Error
            ? deleteMutation.error.message
            : "No se pudo eliminar"}
        </p>
      ) : null}
    </div>
  )
}
