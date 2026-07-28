"use client"

import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { formatDayMonth } from "@/lib/date"
import { cn } from "@/lib/utils"
import { runServerAction } from "@/lib/server-action"
import {
  TIKTOK_CAMPAIGN_LAUNCH_SOURCE_LABELS,
  type TikTokCampaignLaunchSourceValue,
} from "@/lib/services/tiktok/campaign-launch-source.shared"
import { listTikTokCampaignLaunchSourcesAction } from "../_actions/campaign-launch-source"

export const LAUNCH_SOURCES_QUERY_KEY = [
  "tiktok-campaign-launch-sources",
] as const

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

  const currentRow = sourcesQuery.data?.find(
    (row) => row.campaignId === campaignId
  )
  if (!currentRow) return null

  const label = badgeLabel(currentRow.source, currentRow.markedAt)

  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0 px-1.5 py-0 text-[10px] font-medium",
        SOURCE_BADGE_CLASS[currentRow.source]
      )}
      title={
        currentRow.source === "dashboard"
          ? `Lanzada desde el dashboard · ${label}`
          : `Lanzamiento: ${label}`
      }
    >
      {label}
    </Badge>
  )
}
