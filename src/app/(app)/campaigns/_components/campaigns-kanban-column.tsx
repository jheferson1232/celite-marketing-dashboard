"use client"

import { useDroppable } from "@dnd-kit/core"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { CampaignRecord } from "@/lib/services/campaign"
import type { CampaignKanbanStatus } from "@/lib/campaigns/status"
import {
  CAMPAIGN_STATUS_BADGE_CLASS,
  CAMPAIGN_STATUS_LABELS,
} from "../_lib/status-labels"
import { CampaignsKanbanCard } from "./campaigns-kanban-card"

interface CampaignsKanbanColumnProps {
  status: CampaignKanbanStatus
  campaigns: CampaignRecord[]
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
        "flex w-[280px] max-w-[280px] shrink-0 min-h-[420px] flex-col rounded-xl border bg-muted/20",
        highlight && "border-primary/50 bg-primary/5 ring-2 ring-primary/20"
      )}
    >
      <header className="px-4 pt-3 pb-0">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{CAMPAIGN_STATUS_LABELS[status]}</h2>
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
      </header>

      <div className="flex flex-1 flex-col gap-2 p-3">
        {campaigns.length === 0 ? (
          <div
            className={cn(
              "flex flex-1 items-center justify-center rounded-lg border border-dashed px-3 py-8 text-center text-xs text-muted-foreground",
              highlight && "border-primary/40 text-primary"
            )}
          >
            Suelta campañas aquí
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
