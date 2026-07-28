"use client"

import { useCallback, useMemo, useState } from "react"
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
import { resolveTikTokAccountCurrency } from "@/lib/services/tiktok/account-currency"
import { TikTokManageProvider } from "./tiktok-manage-provider"
import { TikTokAccountSelect } from "./tiktok-account-select"
import { useTikTokDashboardAccount } from "./use-tiktok-dashboard-account"
import { useTikTokArchivedCampaigns } from "./use-tiktok-archived-campaigns"
import { LAUNCH_SOURCES_QUERY_KEY } from "./tiktok-campaign-launch-source-label"
import {
  TIKTOK_CAMPAIGNS_COLUMN_VISIBILITY_KEY,
  TIKTOK_CAMPAIGNS_DEFAULT_COLUMN_VISIBILITY,
} from "@/app/(app)/dashboard/_components/campaigns/use-persisted-column-visibility"
import type { DateRange } from "@/lib/services/meta/types"
import {
  RiAdvertisementLine,
  RiMegaphoneLine,
  RiRefreshLine,
} from "@remixicon/react"

export function TikTokContent() {
  const queryClient = useQueryClient()
  const [isReloading, setIsReloading] = useState(false)
  const { dateRange, setDateRange } = useDateRange()
  const {
    accounts,
    accountId,
    setAccountId,
    selectedAccount,
    isLoading: isLoadingAccounts,
  } = useTikTokDashboardAccount()
  const {
    archivedIds,
    archivedMenu,
    feedback: archiveFeedback,
    archiveCampaign,
  } = useTikTokArchivedCampaigns()

  const accountCurrency = resolveTikTokAccountCurrency(
    selectedAccount?.currency
  )

  const dashboardQueryOptions = {
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: Boolean(accountId),
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
            key.startsWith("tiktok-campaign-daily-insights") ||
            key.startsWith("tiktok-campaign-origins") ||
            key.startsWith("tiktok-campaign-launch-sources") ||
            key.startsWith("tiktok-archived-campaigns")
          )
        },
      })
    } finally {
      setIsReloading(false)
    }
  }

  const { data: kpis, isLoading: isLoadingKpis } = useQuery({
    queryKey: ["tiktok-account-kpis", accountId, dateRange],
    queryFn: () =>
      runServerAction(
        getTikTokAccountKpisSummary({
          dateRange,
          accountId: accountId ?? undefined,
        })
      ),
    ...dashboardQueryOptions,
  })

  const { data: campaigns, isLoading: isLoadingCampaigns } = useQuery({
    queryKey: ["tiktok-campaigns", accountId, dateRange],
    queryFn: async () => {
      const rows = await runServerAction(
        getTikTokCampaignsListAction({
          dateRange,
          accountId: accountId ?? undefined,
        })
      )
      await queryClient.invalidateQueries({ queryKey: LAUNCH_SOURCES_QUERY_KEY })
      return rows
    },
    ...dashboardQueryOptions,
  })

  const visibleCampaigns = useMemo(
    () => campaigns?.filter((campaign) => !archivedIds.has(campaign.id)),
    [archivedIds, campaigns]
  )

  const { data: adSetsByCampaignId } = useQuery({
    queryKey: ["tiktok-all-campaign-adgroups", accountId, dateRange],
    queryFn: () =>
      runServerAction(
        getTikTokAllCampaignAdGroupsAction({
          dateRange,
          accountId: accountId ?? undefined,
        })
      ),
    ...dashboardQueryOptions,
  })

  const { data: adInsights, isLoading: isLoadingAdInsights } = useQuery({
    queryKey: ["tiktok-ad-insights", accountId, dateRange],
    queryFn: () =>
      runServerAction(
        getTikTokAdInsightsList({
          dateRange,
          accountId: accountId ?? undefined,
        })
      ),
    ...dashboardQueryOptions,
  })

  const fetchCampaignAdSets = useCallback(
    (input: { campaignId: string; dateRange: DateRange; objective?: string }) =>
      getTikTokCampaignAdGroups({
        ...input,
        accountId: accountId ?? undefined,
      }),
    [accountId]
  )

  const handleAccountChange = useCallback(
    async (nextId: string) => {
      if (nextId === accountId) return
      setAccountId(nextId)
      await runServerAction(clearTikTokCacheAction())
      await queryClient.invalidateQueries({
        predicate: (query) => String(query.queryKey[0]).startsWith("tiktok-"),
      })
    },
    [accountId, queryClient, setAccountId]
  )

  const isDashboardFetching =
    isLoadingKpis ||
    isLoadingCampaigns ||
    isLoadingAdInsights ||
    isLoadingAccounts

  return (
    <div className="flex w-full min-w-0 flex-col gap-6 p-4 sm:gap-8 sm:p-6 lg:p-8">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          Dashboard TikTok
        </h1>
        <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <TikTokAccountSelect
            accounts={accounts}
            value={accountId}
            onChange={handleAccountChange}
            disabled={isLoadingAccounts}
            compact
          />
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
              className="h-8 min-w-0 flex-1 gap-2 px-3 sm:h-9 sm:w-auto sm:flex-none"
              onClick={handleReload}
              disabled={isReloading || !accountId}
            >
              <RiRefreshLine
                className={isReloading ? "size-4 animate-spin" : "size-4"}
              />
              Reload
            </Button>
          </div>
        </div>
      </div>

      <div className="w-full min-w-0">
        <KpiCards
          data={kpis}
          isLoading={isDashboardFetching}
          currency={accountCurrency}
        />
      </div>

      <Tabs
        defaultValue="campaigns"
        className="flex w-full min-w-0 flex-col gap-4"
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
          {archiveFeedback ? (
            <p
              className={
                archiveFeedback.type === "error"
                  ? "text-destructive mb-3 text-sm"
                  : "mb-3 text-sm text-emerald-700 dark:text-emerald-400"
              }
            >
              {archiveFeedback.message}
            </p>
          ) : null}
          <TikTokManageProvider
            accountId={accountId}
            currency={accountCurrency}
          >
            <CampaignsTable
              key={accountId ?? "no-account"}
              data={visibleCampaigns}
              isLoading={isLoadingCampaigns || isLoadingAccounts}
              currency={accountCurrency}
              adSetsQueryKeyPrefix="tiktok-campaign-adgroups"
              fetchCampaignAdSets={fetchCampaignAdSets}
              enableTikTokManage
              tikTokAdSetsByCampaignId={adSetsByCampaignId}
              columnVisibilityStorageKey={
                TIKTOK_CAMPAIGNS_COLUMN_VISIBILITY_KEY
              }
              defaultColumnVisibility={
                TIKTOK_CAMPAIGNS_DEFAULT_COLUMN_VISIBILITY
              }
              originPlatform="tiktok"
              toolbarExtra={archivedMenu}
              onArchiveCampaign={archiveCampaign}
            />
          </TikTokManageProvider>
        </TabsContent>
        <TabsContent value="ads" className="min-w-0 outline-none">
          <AdsView
            data={adInsights}
            isLoading={isLoadingAdInsights || isLoadingAccounts}
            currency={accountCurrency}
            platform="tiktok"
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
