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

export const CAMPAIGN_KANBAN_COLUMN_SKELETON_CLASS =
  "h-[min(720px,calc(100dvh-10rem))] w-[420px] shrink-0 rounded-xl"

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
        "flex w-[420px] max-w-[420px] shrink-0 min-h-[min(720px,calc(100dvh-10rem))] flex-col rounded-xl border bg-muted/20",
        highlight && "border-primary/50 bg-primary/5 ring-2 ring-primary/20"
      )}
    >
      <header className="px-4 pt-4 pb-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{CAMPAIGN_STATUS_LABELS[status]}</h2>
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

      <div className="flex min-h-[280px] flex-1 flex-col gap-3 p-4">
        {campaigns.map((campaign) => (
          <CampaignsKanbanCard
            key={campaign.id}
            campaign={campaign}
            isDragging={activeCampaignId === campaign.id}
          />
        ))}
      </div>
    </section>
  )
}
