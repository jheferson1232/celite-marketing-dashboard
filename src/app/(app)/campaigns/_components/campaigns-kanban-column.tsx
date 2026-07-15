"use client"

import { useDroppable } from "@dnd-kit/core"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  CAMPAIGN_OUTCOME_MIN_SPEND_PEN,
  type CampaignKanbanStatus,
} from "@/lib/campaigns/status"
import type { CampaignKanbanRecord } from "@/lib/services/campaign-kanban-outcomes"
import {
  CAMPAIGN_STATUS_BADGE_CLASS,
  CAMPAIGN_STATUS_LABELS,
} from "../_lib/status-labels"
import { CampaignsKanbanCard } from "./campaigns-kanban-card"

export const CAMPAIGN_KANBAN_COLUMN_SKELETON_CLASS =
  "h-[min(720px,calc(100dvh-10rem))] w-[420px] shrink-0 rounded-xl"

interface CampaignsKanbanColumnProps {
  status: CampaignKanbanStatus
  campaigns: CampaignKanbanRecord[]
  activeCampaignId: string | null
  isOver: boolean
}

export function CampaignsKanbanColumn({
  status,
  campaigns,
  activeCampaignId,
  isOver,
}: CampaignsKanbanColumnProps) {
  const { setNodeRef, isOver: isDroppableOver } = useDroppable({
    id: status,
    data: { status },
  })

  const highlight = isOver || isDroppableOver

  return (
    <section
      ref={setNodeRef}
      aria-label={`Columna ${CAMPAIGN_STATUS_LABELS[status]}`}
      className={cn(
        "flex w-[420px] max-w-[420px] shrink-0 min-h-[min(720px,calc(100dvh-10rem))] flex-col rounded-xl border bg-muted/20",
        status === "winner" && "border-emerald-500/40",
        status === "loser" && "border-destructive/40",
        highlight && "border-primary/50 bg-primary/5 ring-2 ring-primary/20"
      )}
    >
      <header className="px-4 pt-4 pb-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">
            {CAMPAIGN_STATUS_LABELS[status]}
          </h2>
          <Badge
            variant="outline"
            className={cn(
              "min-w-6 tabular-nums",
              CAMPAIGN_STATUS_BADGE_CLASS[status]
            )}
          >
            {campaigns.length}
          </Badge>
        </div>
        {status === "running" ? (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Se clasifica al superar S/ {CAMPAIGN_OUTCOME_MIN_SPEND_PEN} de gasto
            total
          </p>
        ) : null}
        {status === "winner" ? (
          <p className="mt-1 text-[11px] text-muted-foreground">
            CPA total &lt; S/ 15
          </p>
        ) : null}
        {status === "loser" ? (
          <p className="mt-1 text-[11px] text-muted-foreground">
            CPA total &gt; S/ 15
          </p>
        ) : null}
      </header>

      <div className="flex min-h-[280px] flex-1 flex-col gap-3 p-4">
        {campaigns.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            Vacío
          </div>
        ) : (
          campaigns.map((campaign) => (
            <CampaignsKanbanCard
              key={campaign.id}
              campaign={campaign}
              isDragging={activeCampaignId === campaign.id}
            />
          ))
        )}
      </div>
    </section>
  )
}
