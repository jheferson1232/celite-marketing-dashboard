"use client"

import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { CAMPAIGN_STATUS_BADGE_CLASS } from "@/app/(app)/campaigns/_lib/status-labels"
import { formatDayMonth } from "@/lib/date"
import { cn } from "@/lib/utils"
import { runServerAction } from "@/lib/server-action"
import {
  TIKTOK_CAMPAIGN_LAUNCH_SOURCE_LABELS,
  type TikTokCampaignLaunchSourceValue,
} from "@/lib/services/tiktok/campaign-launch-source.shared"
import type { TikTokCampaignKanbanOutcome } from "@/lib/services/campaign-kanban-outcome.shared"
import { KANBAN_OUTCOMES_QUERY_KEY } from "@/lib/services/campaign-kanban-outcome.shared"
import { listTikTokCampaignKanbanOutcomesAction } from "../_actions/campaign-kanban-outcome"
import { listTikTokCampaignLaunchSourcesAction } from "../_actions/campaign-launch-source"

export const LAUNCH_SOURCES_QUERY_KEY = [
  "tiktok-campaign-launch-sources",
] as const

export { KANBAN_OUTCOMES_QUERY_KEY } from "@/lib/services/campaign-kanban-outcome.shared"

const SOURCE_BADGE_CLASS: Record<TikTokCampaignLaunchSourceValue, string> = {
  dashboard:
    "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  manual:
    "border-zinc-500/40 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",
}

function badgeLabel(
  source: TikTokCampaignLaunchSourceValue,
  markedAt: string
): string {
  if (source === "dashboard") return formatDayMonth(markedAt)
  return TIKTOK_CAMPAIGN_LAUNCH_SOURCE_LABELS[source]
}

function badgeClassName(
  source: TikTokCampaignLaunchSourceValue,
  kanbanOutcome: TikTokCampaignKanbanOutcome | null
): string {
  if (source === "dashboard" && kanbanOutcome) {
    return CAMPAIGN_STATUS_BADGE_CLASS[kanbanOutcome]
  }
  return SOURCE_BADGE_CLASS[source]
}

/** Solo lectura: se marca al lanzar desde el dashboard (sin edición manual). */
export function TikTokCampaignLaunchSourceLabel({
  campaignId,
}: {
  campaignId: string
}) {
  const sourcesQuery = useQuery({
    queryKey: LAUNCH_SOURCES_QUERY_KEY,
    queryFn: () => runServerAction(listTikTokCampaignLaunchSourcesAction()),
    staleTime: 60_000,
  })

  const outcomesQuery = useQuery({
    queryKey: KANBAN_OUTCOMES_QUERY_KEY,
    queryFn: () => runServerAction(listTikTokCampaignKanbanOutcomesAction()),
    staleTime: 60_000,
  })

  const currentRow = sourcesQuery.data?.find(
    (row) => row.campaignId === campaignId
  )
  if (!currentRow) return null

  const kanbanOutcome =
    outcomesQuery.data?.find((row) => row.campaignId === campaignId)?.outcome ??
    null

  const label = badgeLabel(currentRow.source, currentRow.markedAt)

  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0 px-1.5 py-0 text-[10px] font-medium",
        badgeClassName(currentRow.source, kanbanOutcome)
      )}
      title={
        currentRow.source === "dashboard"
          ? kanbanOutcome === "winner"
            ? `Ganadora · Publicada desde Campaigns · ${label}`
            : kanbanOutcome === "loser"
              ? `Perdedora · Publicada desde Campaigns · ${label}`
              : `Publicada desde Campaigns · ${label}`
          : `Lanzamiento: ${label}`
      }
    >
      {label}
    </Badge>
  )
}
