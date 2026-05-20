"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { runServerAction } from "@/lib/server-action"
import { getAccountKpisSummary } from "../_actions/account-kpis"
import { getCampaignsList } from "../_actions/campaigns-list"
import { getAdInsightsList } from "../_actions/ad-insights"
import { clearMetaCacheAction } from "../_actions/clear-meta-cache"
import { useDateRange } from "../_lib/use-date-range"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { KpiCards } from "./kpi-cards"
import { CampaignsTable } from "./campaigns"
import { AdsView } from "./ads"
import { DateRangePicker } from "./date-range-picker"
import {
  RiAdvertisementLine,
  RiMegaphoneLine,
  RiRefreshLine,
} from "@remixicon/react"

export function DashboardContent() {
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
      await runServerAction(clearMetaCacheAction())
      await queryClient.invalidateQueries({
        predicate: (query) =>
          ["account-kpis", "campaigns", "ad-insights"].includes(
            String(query.queryKey[0])
          ),
      })
    } finally {
      setIsReloading(false)
    }
  }

  const { data: kpis, isLoading: isLoadingKpis } = useQuery({
    queryKey: ["account-kpis", dateRange],
    queryFn: () => runServerAction(getAccountKpisSummary(dateRange)),
    ...dashboardQueryOptions,
  })

  const { data: campaigns, isLoading: isLoadingCampaigns } = useQuery({
    queryKey: ["campaigns", dateRange],
    queryFn: () => runServerAction(getCampaignsList(dateRange)),
    ...dashboardQueryOptions,
  })

  const { data: adInsights, isLoading: isLoadingAdInsights } = useQuery({
    queryKey: ["ad-insights", dateRange],
    queryFn: () => runServerAction(getAdInsightsList(dateRange)),
    ...dashboardQueryOptions,
  })

  return (
    <div className="flex w-full min-w-0 flex-col gap-6 p-6 lg:gap-8 lg:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          Meta
        </h1>
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

      <KpiCards data={kpis} isLoading={isLoadingKpis} />

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
          <CampaignsTable data={campaigns} isLoading={isLoadingCampaigns} />
        </TabsContent>
        <TabsContent value="ads">
          <AdsView data={adInsights} isLoading={isLoadingAdInsights} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
