"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { runServerAction } from "@/lib/server-action"
import { getTikTokAccountKpisSummary } from "../_actions/account-kpis"
import { getTikTokCampaignsListAction } from "../_actions/campaigns-list"
import { getTikTokAdInsightsList } from "../_actions/ad-insights"
import { clearTikTokCacheAction } from "../_actions/clear-tiktok-cache"
import { getTikTokAllCampaignAdGroupsAction } from "../_actions/all-campaign-adgroups"
import { getTikTokCampaignAdGroups } from "../_actions/campaign-adgroups"
import { useDateRange } from "@/app/(app)/dashboard/_lib/use-date-range"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { KpiCards } from "@/app/(app)/dashboard/_components/kpi-cards"
import { CampaignsTable } from "@/app/(app)/dashboard/_components/campaigns"
import { AdsView } from "@/app/(app)/dashboard/_components/ads"
import { DateRangePicker } from "@/app/(app)/dashboard/_components/date-range-picker"
import { ThemeToggleButton } from "@/app/(app)/dashboard/_components/theme-toggle-button"
import { TIKTOK_DASHBOARD_CURRENCY } from "@/lib/format"
import { TikTokManageProvider } from "./tiktok-manage-provider"
import {
  TIKTOK_CAMPAIGNS_COLUMN_VISIBILITY_KEY,
  TIKTOK_CAMPAIGNS_DEFAULT_COLUMN_VISIBILITY,
} from "@/app/(app)/dashboard/_components/campaigns/use-persisted-column-visibility"
import {
  RiAdvertisementLine,
  RiMegaphoneLine,
  RiRefreshLine,
} from "@remixicon/react"

export function TikTokContent() {
  const queryClient = useQueryClient()
  const [isReloading, setIsReloading] = useState(false)
  const { dateRange, setDateRange } = useDateRange()

  const dashboardQueryOptions = {
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  } as const

  const handleReload = async () => {
    setIsReloading(true)
    try {
      await runServerAction(clearTikTokCacheAction())
      await queryClient.invalidateQueries({
        predicate: (query) => {
          const key = String(query.queryKey[0])
          return (
            key.startsWith("tiktok-account-kpis") ||
            key.startsWith("tiktok-campaigns") ||
            key.startsWith("tiktok-ad-insights") ||
            key.startsWith("tiktok-campaign-adgroups") ||
            key.startsWith("tiktok-all-campaign-adgroups") ||
            key.startsWith("tiktok-campaign-daily-insights")
          )
        },
      })
    } finally {
      setIsReloading(false)
    }
  }

  const { data: kpis, isLoading: isLoadingKpis } = useQuery({
    queryKey: ["tiktok-account-kpis", dateRange],
    queryFn: () => runServerAction(getTikTokAccountKpisSummary(dateRange)),
    ...dashboardQueryOptions,
  })

  const { data: campaigns, isLoading: isLoadingCampaigns } = useQuery({
    queryKey: ["tiktok-campaigns", dateRange],
    queryFn: () => runServerAction(getTikTokCampaignsListAction(dateRange)),
    ...dashboardQueryOptions,
  })

  const { data: adSetsByCampaignId } = useQuery({
    queryKey: ["tiktok-all-campaign-adgroups", dateRange],
    queryFn: () => runServerAction(getTikTokAllCampaignAdGroupsAction(dateRange)),
    ...dashboardQueryOptions,
  })

  const { data: adInsights, isLoading: isLoadingAdInsights } = useQuery({
    queryKey: ["tiktok-ad-insights", dateRange],
    queryFn: () => runServerAction(getTikTokAdInsightsList(dateRange)),
    ...dashboardQueryOptions,
  })

  return (
    <div className="flex w-full min-w-0 flex-col gap-6 p-4 sm:gap-8 sm:p-6 lg:p-8">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Dashboard TikTok
          </h1>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <DateRangePicker
            from={dateRange.from}
            to={dateRange.to}
            onRangeChange={(range) => setDateRange(range)}
            className="w-full sm:w-auto"
          />
          <div className="flex w-full gap-2 sm:w-auto">
            <ThemeToggleButton />
            <Button
              type="button"
              variant="outline"
              className="h-9 min-w-0 flex-1 gap-2 px-3 sm:flex-none sm:w-auto"
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
      </div>

      <div className="min-w-0 w-full">
        <KpiCards
          data={kpis}
          isLoading={isLoadingKpis}
          currency={TIKTOK_DASHBOARD_CURRENCY}
        />
      </div>

      <Tabs
        defaultValue="campaigns"
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
          <TikTokManageProvider>
            <CampaignsTable
              data={campaigns}
              isLoading={isLoadingCampaigns}
              currency={TIKTOK_DASHBOARD_CURRENCY}
              adSetsQueryKeyPrefix="tiktok-campaign-adgroups"
              fetchCampaignAdSets={getTikTokCampaignAdGroups}
              enableTikTokManage
              tikTokAdSetsByCampaignId={adSetsByCampaignId}
              columnVisibilityStorageKey={TIKTOK_CAMPAIGNS_COLUMN_VISIBILITY_KEY}
              defaultColumnVisibility={TIKTOK_CAMPAIGNS_DEFAULT_COLUMN_VISIBILITY}
            />
          </TikTokManageProvider>
        </TabsContent>
        <TabsContent value="ads" className="min-w-0 outline-none">
          <AdsView
            data={adInsights}
            isLoading={isLoadingAdInsights}
            currency={TIKTOK_DASHBOARD_CURRENCY}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
