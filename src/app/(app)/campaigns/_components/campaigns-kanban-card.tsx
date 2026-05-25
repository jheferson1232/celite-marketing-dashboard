"use client"

import Link from "next/link"
import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "@/lib/utils"
import type { CampaignRecord } from "@/lib/services/campaign"

interface CampaignsKanbanCardProps {
  campaign: CampaignRecord
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
}: CampaignsKanbanCardProps) {
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
        <p className="truncate text-sm font-semibold leading-tight">{campaign.name}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {campaign.config.adgroups.length} conjuntos · {formatUpdatedAt(campaign.updatedAt)}
        </p>
      </Link>
    </div>
  )
}

export function CampaignsKanbanCard({
  campaign,
  isDragging = false,
}: CampaignsKanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: campaign.id,
    data: { campaign, status: campaign.status },
  })

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "opacity-40")}>
      <div {...listeners} {...attributes}>
        <CampaignKanbanCardView campaign={campaign} />
      </div>
    </div>
  )
}
