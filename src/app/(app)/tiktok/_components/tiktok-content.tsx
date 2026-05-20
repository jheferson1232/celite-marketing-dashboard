"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { runServerAction } from "@/lib/server-action"
import { getTikTokAccountKpisSummary } from "../_actions/account-kpis"
import { getTikTokCampaignsListAction } from "../_actions/campaigns-list"
import { getTikTokAdInsightsList } from "../_actions/ad-insights"
import { clearTikTokCacheAction } from "../_actions/clear-tiktok-cache"
import { getTikTokCampaignAdGroups } from "../_actions/campaign-adgroups"
import { useDateRange } from "@/app/(app)/dashboard/_lib/use-date-range"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { KpiCards } from "@/app/(app)/dashboard/_components/kpi-cards"
import { CampaignsTable } from "@/app/(app)/dashboard/_components/campaigns"
import { AdsView } from "@/app/(app)/dashboard/_components/ads"
import { DateRangePicker } from "@/app/(app)/dashboard/_components/date-range-picker"
import { TIKTOK_DASHBOARD_CURRENCY } from "@/lib/format"
import { TikTokManageProvider } from "./tiktok-manage-provider"
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

  const { data: adInsights, isLoading: isLoadingAdInsights } = useQuery({
    queryKey: ["tiktok-ad-insights", dateRange],
    queryFn: () => runServerAction(getTikTokAdInsightsList(dateRange)),
    ...dashboardQueryOptions,
  })

  return (
    <div className="flex w-full min-w-0 flex-col gap-6 p-6 lg:gap-8 lg:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard TikTok</h1>
        <div className="flex items-center gap-2">
          <DateRangePicker
            from={dateRange.from}
            to={dateRange.to}
            onRangeChange={(range) => setDateRange(range)}
          />
          <Button
            type="button"
            variant="outline"
            className="h-9 gap-2 px-3"
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
        currency={TIKTOK_DASHBOARD_CURRENCY}
      />

      <Tabs defaultValue="campaigns" className="flex flex-col gap-4">
        <TabsList>
          <TabsTrigger value="campaigns">
            <RiMegaphoneLine />
            Campañas
          </TabsTrigger>
          <TabsTrigger value="ads">
            <RiAdvertisementLine />
            Anuncios
          </TabsTrigger>
        </TabsList>
        <TabsContent value="campaigns">
          <TikTokManageProvider>
            <CampaignsTable
              data={campaigns}
              isLoading={isLoadingCampaigns}
              currency={TIKTOK_DASHBOARD_CURRENCY}
              adSetsQueryKeyPrefix="tiktok-campaign-adgroups"
              fetchCampaignAdSets={getTikTokCampaignAdGroups}
              enableTikTokManage
            />
          </TikTokManageProvider>
        </TabsContent>
        <TabsContent value="ads">
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
