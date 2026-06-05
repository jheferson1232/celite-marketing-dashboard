"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { getCampaignsList } from "@/app/(app)/dashboard/_actions/campaigns-list"
import { getTikTokAllCampaignAdGroupsAction } from "@/app/(app)/tiktok/_actions/all-campaign-adgroups"
import { getTikTokCampaignsListAction } from "@/app/(app)/tiktok/_actions/campaigns-list"
import type { DateRange } from "@/lib/services/meta/types"
import { runServerAction } from "@/lib/server-action"

const dashboardQueryOptions = {
  staleTime: 2 * 60 * 1000,
  refetchOnWindowFocus: false,
} as const

export function useProductoLinkedCampaigns(
  linkedTikTokIds: Set<string>,
  linkedMetaIds: Set<string>,
  dateRange: DateRange
) {
  const hasTikTok = linkedTikTokIds.size > 0
  const hasMeta = linkedMetaIds.size > 0

  const { data: tiktokCampaignsAll = [], isLoading: isLoadingTikTokCampaigns } =
    useQuery({
      queryKey: ["tiktok-campaigns", dateRange],
      queryFn: () => runServerAction(getTikTokCampaignsListAction({ dateRange })),
      enabled: hasTikTok,
      ...dashboardQueryOptions,
    })

  const { data: metaCampaignsAll = [], isLoading: isLoadingMetaCampaigns } =
    useQuery({
      queryKey: ["meta-campaigns", dateRange],
      queryFn: () => runServerAction(getCampaignsList(dateRange)),
      enabled: hasMeta,
      ...dashboardQueryOptions,
    })

  const { data: tiktokAdSetsByCampaignId } = useQuery({
    queryKey: ["tiktok-all-campaign-adgroups", dateRange],
    queryFn: () =>
      runServerAction(getTikTokAllCampaignAdGroupsAction({ dateRange })),
    enabled: hasTikTok,
    ...dashboardQueryOptions,
  })

  const tiktokCampaigns = useMemo(
    () => tiktokCampaignsAll.filter((c) => linkedTikTokIds.has(c.id)),
    [tiktokCampaignsAll, linkedTikTokIds]
  )

  const metaCampaigns = useMemo(
    () => metaCampaignsAll.filter((c) => linkedMetaIds.has(c.id)),
    [metaCampaignsAll, linkedMetaIds]
  )

  return {
    tiktokCampaigns,
    metaCampaigns,
    isLoadingCampaigns: isLoadingTikTokCampaigns || isLoadingMetaCampaigns,
    tiktokAdSetsByCampaignId,
  }
}
