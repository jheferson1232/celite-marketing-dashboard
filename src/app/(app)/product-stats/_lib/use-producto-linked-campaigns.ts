"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { getCampaignsList } from "@/app/(app)/dashboard/_actions/campaigns-list"
import { getCampaignsExtendedMetrics } from "@/app/(app)/dashboard/_actions/campaigns-extended-metrics"
import { getTikTokAllCampaignAdGroupsAction } from "@/app/(app)/tiktok/_actions/all-campaign-adgroups"
import { getTikTokCampaignsListAction } from "@/app/(app)/tiktok/_actions/campaigns-list"
import type { CampaignRow, DateRange } from "@/lib/services/meta/types"
import { runServerAction } from "@/lib/server-action"

const dashboardQueryOptions = {
  staleTime: 2 * 60 * 1000,
  refetchOnWindowFocus: false,
} as const

const extendedQueryOptions = {
  staleTime: 15 * 60 * 1000,
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

  const {
    data: extendedMetrics,
    isFetching: isExtendedMetricsFetching,
    isPending: isExtendedMetricsPending,
    isError: isExtendedMetricsError,
    error: extendedMetricsError,
  } = useQuery({
    queryKey: ["campaigns-extended-metrics"],
    queryFn: () => runServerAction(getCampaignsExtendedMetrics()),
    enabled: hasMeta,
    ...extendedQueryOptions,
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

  const metaCampaigns = useMemo((): CampaignRow[] => {
    const linked = metaCampaignsAll.filter((c) => linkedMetaIds.has(c.id))
    if (!extendedMetrics) return linked

    return linked.map((campaign) => {
      const extended = extendedMetrics[campaign.id]
      return {
        ...campaign,
        purchases7d: extended?.purchases7d ?? 0,
        cpa7d: extended?.cpa7d ?? 0,
        totalPurchases: extended?.totalPurchases ?? 0,
        totalSpend: extended?.totalSpend ?? 0,
        totalCpa: extended?.totalCpa ?? 0,
      }
    })
  }, [metaCampaignsAll, linkedMetaIds, extendedMetrics])

  const extendedMetricsLoading =
    hasMeta &&
    !extendedMetrics &&
    (isExtendedMetricsPending || isExtendedMetricsFetching)

  return {
    tiktokCampaigns,
    metaCampaigns,
    isLoadingCampaigns: isLoadingTikTokCampaigns || isLoadingMetaCampaigns,
    tiktokAdSetsByCampaignId,
    extendedMetricsLoading,
    extendedMetricsError: isExtendedMetricsError
      ? (extendedMetricsError as Error)
      : null,
  }
}
