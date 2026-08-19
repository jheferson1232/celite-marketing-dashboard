"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { getTodayDateRange } from "@/app/(app)/dashboard/_lib/use-date-range"
import {
  getMetaLinkedCampaignsAction,
  getMetaLinkedExtendedMetricsAction,
  getTikTokLinkedCampaignsAction,
} from "../_actions/linked-campaigns"
import type { CampaignRow } from "@/lib/services/meta/types"
import { runServerAction } from "@/lib/server-action"

const dashboardQueryOptions = {
  staleTime: 2 * 60 * 1000,
  refetchOnWindowFocus: false,
} as const

const extendedQueryOptions = {
  staleTime: 15 * 60 * 1000,
  refetchOnWindowFocus: false,
} as const

type LinkedCampaign = {
  campaignId: string
  campaignName: string | null
  platform: string
}

function placeholderCampaignRow(id: string, name: string): CampaignRow {
  return {
    id,
    name,
    status: "UNKNOWN",
    spend: 0,
    impressions: 0,
    adSetsCount: 0,
    activeAdsCount: 0,
    ctr: 0,
    cpc: 0,
    results: 0,
    costPerResult: 0,
    roas: 0,
    objective: "PURCHASE",
  }
}

function mergeLinkedCampaigns(
  links: LinkedCampaign[],
  fromApi: CampaignRow[]
): CampaignRow[] {
  const byId = new Map(fromApi.map((c) => [c.id, c]))
  return links.map(
    (link) =>
      byId.get(link.campaignId) ??
      placeholderCampaignRow(
        link.campaignId,
        link.campaignName?.trim() || link.campaignId
      )
  )
}

function sortedIds(links: LinkedCampaign[]): string[] {
  return links.map((c) => c.campaignId).toSorted()
}

/** Métricas de periodo (Gasto, Compras, CPA) = hoy, como en el dashboard. */
export function useProductoLinkedCampaigns(productCampaigns: LinkedCampaign[]) {
  const linkedTikTok = useMemo(
    () => productCampaigns.filter((c) => c.platform !== "meta"),
    [productCampaigns]
  )
  const linkedMeta = useMemo(
    () => productCampaigns.filter((c) => c.platform === "meta"),
    [productCampaigns]
  )

  const tiktokIds = useMemo(() => sortedIds(linkedTikTok), [linkedTikTok])
  const metaIds = useMemo(() => sortedIds(linkedMeta), [linkedMeta])

  const hasTikTok = tiktokIds.length > 0
  const hasMeta = metaIds.length > 0
  const todayRange = getTodayDateRange()

  const {
    data: tiktokCampaignsFromApi = [],
    isLoading: isLoadingTikTokCampaigns,
    isError: isTikTokCampaignsError,
    error: tiktokCampaignsError,
  } = useQuery({
    queryKey: ["product-linked-tiktok-campaigns", tiktokIds, todayRange],
    queryFn: () =>
      runServerAction(
        getTikTokLinkedCampaignsAction({
          campaignIds: tiktokIds,
          dateRange: todayRange,
        })
      ),
    enabled: hasTikTok,
    ...dashboardQueryOptions,
  })

  const { data: metaCampaignsFromApi = [], isLoading: isLoadingMetaCampaigns } =
    useQuery({
      queryKey: ["product-linked-meta-campaigns", metaIds, todayRange],
      queryFn: () =>
        runServerAction(
          getMetaLinkedCampaignsAction({
            campaignIds: metaIds,
            dateRange: todayRange,
          })
        ),
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
    queryKey: ["product-linked-meta-extended", metaIds],
    queryFn: () =>
      runServerAction(
        getMetaLinkedExtendedMetricsAction({ campaignIds: metaIds })
      ),
    enabled: hasMeta,
    ...extendedQueryOptions,
  })

  const tiktokCampaigns = useMemo(
    () => mergeLinkedCampaigns(linkedTikTok, tiktokCampaignsFromApi),
    [linkedTikTok, tiktokCampaignsFromApi]
  )

  const metaCampaigns = useMemo((): CampaignRow[] => {
    const linked = mergeLinkedCampaigns(linkedMeta, metaCampaignsFromApi)
    if (!extendedMetrics) return linked

    return linked.map((campaign) => {
      const extended = extendedMetrics[campaign.id]
      if (!extended) return campaign
      return {
        ...campaign,
        purchases7d: extended.purchases7d ?? 0,
        cpa7d: extended.cpa7d ?? 0,
        totalPurchases: extended.totalPurchases ?? 0,
        totalSpend: extended.totalSpend ?? 0,
        totalCpa: extended.totalCpa ?? 0,
      }
    })
  }, [metaCampaignsFromApi, linkedMeta, extendedMetrics])

  const extendedMetricsLoading =
    hasMeta &&
    !extendedMetrics &&
    (isExtendedMetricsPending || isExtendedMetricsFetching)

  return {
    tiktokCampaigns,
    metaCampaigns,
    isLoadingCampaigns: isLoadingTikTokCampaigns || isLoadingMetaCampaigns,
    tiktokCampaignsError: isTikTokCampaignsError
      ? (tiktokCampaignsError as Error)
      : null,
    extendedMetricsLoading,
    extendedMetricsError: isExtendedMetricsError
      ? (extendedMetricsError as Error)
      : null,
  }
}
