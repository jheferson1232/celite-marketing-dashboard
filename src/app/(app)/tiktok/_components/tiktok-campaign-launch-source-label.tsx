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
import type { CampaignPerformanceStatus } from "@/app/(app)/dashboard/_components/campaigns/types"
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

const PERFORMANCE_BADGE_CLASS: Partial<
  Record<CampaignPerformanceStatus, string>
> = {
  EXCELENTE:
    "border-emerald-500/40 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100",
  CRITICO: "border-destructive/40 bg-destructive/15 text-destructive",
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
  performanceStatus?: CampaignPerformanceStatus | null
): string {
  if (source === "dashboard" && performanceStatus) {
    return (
      PERFORMANCE_BADGE_CLASS[performanceStatus] ?? SOURCE_BADGE_CLASS.dashboard
    )
  }
  return SOURCE_BADGE_CLASS[source]
}

/** Solo lectura: se marca al lanzar desde el dashboard (sin edición manual). */
export function TikTokCampaignLaunchSourceLabel({
  campaignId,
  performanceStatus = null,
}: {
  campaignId: string
  /** Excelente → verde, crítico → rojo (dashboard TikTok). */
  performanceStatus?: CampaignPerformanceStatus | null
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
        badgeClassName(currentRow.source, performanceStatus)
      )}
      title={
        currentRow.source === "dashboard"
          ? `Publicada desde Campaigns · ${label}`
          : `Lanzamiento: ${label}`
      }
    >
      {label}
    </Badge>
  )
}
