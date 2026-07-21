"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { runServerAction } from "@/lib/server-action"
import type { CampaignRow } from "@/lib/services/meta/types"
import { getAccountKpisSummary } from "../_actions/account-kpis"
import { getCampaignsList } from "../_actions/campaigns-list"
import { getCampaignsExtendedMetrics } from "../_actions/campaigns-extended-metrics"
import { getAdInsightsList } from "../_actions/ad-insights"
import { getMetaLandingUrlsMapAction } from "../_actions/landing-urls-map"
import { warmMetaAdsetInsightsAction } from "../_actions/adset-insights"
import { clearMetaCacheAction } from "../_actions/clear-meta-cache"
import { getMetaApiStatus } from "../_lib/meta-api-status"
import { useDateRange } from "../_lib/use-date-range"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { KpiCards } from "./kpi-cards"
import { CampaignsTable } from "./campaigns"
import { AdsView } from "./ads"
import { DateRangePicker } from "./date-range-picker"
import { MetaApiStatusIndicator } from "./meta-api-status-indicator"
import {
  RiAdvertisementLine,
  RiMegaphoneLine,
  RiRefreshLine,
} from "@remixicon/react"

export function DashboardContent() {
  const queryClient = useQueryClient()
  const [isReloading, setIsReloading] = useState(false)
  const [activeTab, setActiveTab] = useState("campaigns")
  const { dateRange, setDateRange } = useDateRange()

  const dashboardQueryOptions = {
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  } as const

  const handleReload = async () => {
    setIsReloading(true)
    try {
      await runServerAction(clearMetaCacheAction())
      await queryClient.invalidateQueries({
        predicate: (query) =>
          [
            "account-kpis",
            "campaigns",
            "campaigns-extended-metrics",
            "ad-insights",
            "meta-campaign-landing-urls",
            "meta-landing-urls-map",
            "meta-adset-insights-warm",
          ].includes(String(query.queryKey[0])),
      })
    } finally {
      setIsReloading(false)
    }
  }

  const kpisQuery = useQuery({
    queryKey: ["account-kpis", dateRange],
    queryFn: () => runServerAction(getAccountKpisSummary(dateRange)),
    ...dashboardQueryOptions,
  })

  const campaignsQuery = useQuery({
    queryKey: ["campaigns", dateRange],
    queryFn: () => runServerAction(getCampaignsList(dateRange)),
    ...dashboardQueryOptions,
  })

  const metaApiStatus = getMetaApiStatus({
    isReloading,
    campaigns: campaignsQuery,
    kpis: kpisQuery,
  })

  const { data: kpis, isLoading: isLoadingKpis } = kpisQuery
  const {
    data: campaigns,
    isLoading: isLoadingCampaigns,
    error: campaignsError,
  } = campaignsQuery

  const extendedQueryOptions = {
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  } as const

  const [extendedMetricsEnabled, setExtendedMetricsEnabled] = useState(false)
  const [landingMapEnabled, setLandingMapEnabled] = useState(false)
  const [adsetInsightsWarmEnabled, setAdsetInsightsWarmEnabled] = useState(false)

  useEffect(() => {
    if (!campaigns?.length) {
      setExtendedMetricsEnabled(false)
      setLandingMapEnabled(false)
      setAdsetInsightsWarmEnabled(false)
      return
    }
    const adsetTimer = window.setTimeout(() => setAdsetInsightsWarmEnabled(true), 1_500)
    const landingTimer = window.setTimeout(() => setLandingMapEnabled(true), 4_000)
    const extendedTimer = window.setTimeout(
      () => setExtendedMetricsEnabled(true),
      2_000
    )
    return () => {
      window.clearTimeout(adsetTimer)
      window.clearTimeout(landingTimer)
      window.clearTimeout(extendedTimer)
    }
  }, [campaigns?.length, dateRange.from, dateRange.to])

  useQuery({
    queryKey: ["meta-adset-insights-warm", dateRange],
    queryFn: () => runServerAction(warmMetaAdsetInsightsAction(dateRange)),
    enabled: adsetInsightsWarmEnabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const {
    data: landingUrlsMap,
    isFetching: isLandingUrlsMapFetching,
    isPending: isLandingUrlsMapPending,
  } = useQuery({
    queryKey: ["meta-landing-urls-map"],
    queryFn: () => runServerAction(getMetaLandingUrlsMapAction()),
    enabled: landingMapEnabled,
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const metaLandingUrlsLoading =
    landingMapEnabled && (isLandingUrlsMapPending || isLandingUrlsMapFetching)

  const {
    data: extendedMetrics,
    isFetching: isExtendedMetricsFetching,
    isPending: isExtendedMetricsPending,
    isError: isExtendedMetricsError,
    error: extendedMetricsError,
  } = useQuery({
    queryKey: ["campaigns-extended-metrics"],
    queryFn: () => runServerAction(getCampaignsExtendedMetrics()),
    enabled: extendedMetricsEnabled,
    ...extendedQueryOptions,
  })

  const extendedMetricsLoading =
    extendedMetricsEnabled &&
    !extendedMetrics &&
    (isExtendedMetricsPending || isExtendedMetricsFetching)

  const campaignsEnriched = useMemo((): CampaignRow[] | undefined => {
    if (!campaigns) return undefined

    return campaigns.map((campaign) => {
      const urls = landingUrlsMap?.[campaign.id]
      const withUrls =
        urls && urls.length > 0
          ? { ...campaign, landingUrls: urls }
          : campaign

      if (!extendedMetrics) return withUrls

      const extended = extendedMetrics[campaign.id]
      return {
        ...withUrls,
        purchases7d: extended?.purchases7d ?? 0,
        cpa7d: extended?.cpa7d ?? 0,
        totalPurchases: extended?.totalPurchases ?? 0,
        totalSpend: extended?.totalSpend ?? 0,
        totalCpa: extended?.totalCpa ?? 0,
      }
    })
  }, [campaigns, extendedMetrics, landingUrlsMap])

  const { data: adInsights, isLoading: isLoadingAdInsights } = useQuery({
    queryKey: ["ad-insights", dateRange],
    queryFn: () => runServerAction(getAdInsightsList(dateRange)),
    enabled: activeTab === "ads",
    ...dashboardQueryOptions,
  })

  return (
    <div className="flex w-full min-w-0 flex-col gap-6 p-4 sm:gap-8 sm:p-6 lg:p-8">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Meta</h1>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <MetaApiStatusIndicator status={metaApiStatus} />
          <DateRangePicker
            from={dateRange.from}
            to={dateRange.to}
            onRangeChange={(range) => setDateRange(range)}
            className="w-full sm:w-auto"
          />
          <Button
            type="button"
            variant="outline"
            className="h-9 min-w-0 gap-2 px-3"
            onClick={handleReload}
            disabled={isReloading}
          >
            <RiRefreshLine
              className={isReloading ? "size-4 animate-spin" : "size-4"}
            />
            Reload
          </Button>
        </div>
      </div>

      <KpiCards
        data={kpis}
        isLoading={isLoadingKpis}
        lastMetric="addToCart"
      />

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex min-w-0 w-full flex-col gap-4"
      >
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="campaigns" className="flex-1 sm:flex-none">
            <RiMegaphoneLine />
            Campañas
          </TabsTrigger>
          <TabsTrigger value="ads" className="flex-1 sm:flex-none">
            <RiAdvertisementLine />
            Anuncios
          </TabsTrigger>
        </TabsList>
        <TabsContent value="campaigns" className="min-w-0 outline-none">
          <CampaignsTable
            data={campaignsEnriched}
            isLoading={isLoadingCampaigns}
            error={campaignsError}
            enableMetaExtendedMetrics
            showAllCampaignsFilter
            showMetaActiveCampaignFilter
            metaLandingUrlsLoading={metaLandingUrlsLoading}
            extendedMetricsLoading={extendedMetricsLoading}
            extendedMetricsError={
              isExtendedMetricsError
                ? (extendedMetricsError as Error)
                : null
            }
          />
        </TabsContent>
        <TabsContent value="ads" className="min-w-0 outline-none">
          <AdsView data={adInsights} isLoading={isLoadingAdInsights} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
