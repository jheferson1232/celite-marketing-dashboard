"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  RiMetaLine,
  RiRefreshLine,
  RiShoppingBag3Line,
  RiTiktokLine,
  RiFundsLine,
} from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { runServerAction } from "@/lib/server-action"
import { useDateRange } from "@/app/(app)/dashboard/_lib/use-date-range"
import { getSummaryKpisAction } from "../_actions/summary-kpis"
import { clearSummaryCacheAction } from "../_actions/clear-summary-cache"
import {
  SummaryPinCard,
  formatSummaryCpa,
  formatSummaryOrders,
  formatSummarySpendCop,
} from "./summary-pin-card"
import { SummaryMobileThemeToggle } from "./summary-mobile-theme-toggle"
import { SummaryPeriodPicker } from "./summary-period-picker"
import { SummaryProductsTableSection } from "./summary-products-table"

function SummarySection({
  title,
  columns = "default",
  children,
}: {
  title: string
  columns?: "default" | "two"
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3 sm:gap-4">
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      <div
        className={
          columns === "two"
            ? "grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:gap-4"
            : "grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3 lg:gap-4"
        }
      >
        {children}
      </div>
    </section>
  )
}

export function SummaryContent() {
  const queryClient = useQueryClient()
  const [isReloading, setIsReloading] = useState(false)
  const { dateRange, setDateRange } = useDateRange()

  const queryOptions = {
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  } as const

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["summary-kpis", dateRange],
    queryFn: () => runServerAction(getSummaryKpisAction(dateRange)),
    ...queryOptions,
  })

  const handleReload = async () => {
    setIsReloading(true)
    try {
      await runServerAction(clearSummaryCacheAction())
      await queryClient.invalidateQueries({
        predicate: (query) => {
          const key = String(query.queryKey[0])
          return key === "summary-kpis" || key === "summary-products-table"
        },
      })
    } finally {
      setIsReloading(false)
    }
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-6 p-4 sm:gap-8 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              Resumen
            </h1>
          </div>
          <SummaryMobileThemeToggle />
        </div>
        <SummaryPeriodPicker
          from={dateRange.from}
          to={dateRange.to}
          onRangeChange={(range) => setDateRange(range)}
          endAction={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-[34px] shrink-0 gap-1.5 px-3"
              onClick={handleReload}
              disabled={isReloading}
            >
              <RiRefreshLine
                className={isReloading ? "size-3.5 animate-spin" : "size-3.5"}
              />
              Reload
            </Button>
          }
        />
      </div>

      {isError ? (
        <p className="text-sm text-destructive">
          {error?.message ?? "No se pudo cargar el resumen."}
        </p>
      ) : null}

      {isLoading ? (
        <div className="flex flex-col gap-6">
          {[
            { title: "Gasto", cols: 3 },
            { title: "Compras", cols: 3 },
            { title: "CPA", cols: 3 },
          ].map(({ title, cols }) => (
            <div key={title} className="flex flex-col gap-3">
              <Skeleton className="h-4 w-24" />
              <div
                className={
                  cols === 2
                    ? "grid grid-cols-1 gap-3 min-[480px]:grid-cols-2"
                    : "grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3"
                }
              >
                {Array.from({ length: cols }).map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-xl sm:h-32" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : data ? (
        <div className="flex flex-col gap-6 sm:gap-8">
          <SummarySection title="Gasto">
            <SummaryPinCard
              title="Facebook Ads"
              icon={<RiMetaLine className="size-4 sm:size-5" />}
              value={formatSummarySpendCop(data.meta.spendCop)}
              changePct={data.meta.spendChangePct}
            />
            <SummaryPinCard
              title="TikTok Ads"
              icon={<RiTiktokLine className="size-4 sm:size-5" />}
              value={formatSummarySpendCop(data.tiktok.spendCop)}
              changePct={data.tiktok.spendChangePct}
              subtitle={`S/ ${data.tiktok.spendPen.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} orig.`}
            />
            <SummaryPinCard
              title="Ads"
              icon={<RiFundsLine className="size-4 sm:size-5" />}
              value={formatSummarySpendCop(data.total.spendCop)}
              changePct={data.total.spendChangePct}
            />
          </SummarySection>

          <SummarySection title="Compras">
            <SummaryPinCard
              title="Facebook"
              icon={<RiMetaLine className="size-4 sm:size-5" />}
              value={formatSummaryOrders(data.meta.purchases)}
              changePct={data.meta.purchasesChangePct}
              subtitle="Compras Meta Ads"
            />
            <SummaryPinCard
              title="TikTok"
              icon={<RiTiktokLine className="size-4 sm:size-5" />}
              value={formatSummaryOrders(data.tiktok.purchases)}
              changePct={data.tiktok.purchasesChangePct}
              subtitle="Compras TikTok Ads"
            />
            <SummaryPinCard
              title="Total pedidos"
              icon={
                <RiShoppingBag3Line className="size-4 text-emerald-600 sm:size-5" />
              }
              value={formatSummaryOrders(data.total.purchases)}
              changePct={data.total.purchasesChangePct}
              subtitle="Meta + TikTok"
              valueClassName="text-emerald-700 dark:text-emerald-400"
            />
          </SummarySection>

          <SummarySection title="CPA">
            <SummaryPinCard
              title="Facebook Ads"
              icon={<RiMetaLine className="size-4 sm:size-5" />}
              value={formatSummaryCpa(data.meta.cpa, "COP")}
              changePct={data.meta.cpaChangePct}
              subtitle="Costo por compra · COP"
            />
            <SummaryPinCard
              title="TikTok Ads"
              icon={<RiTiktokLine className="size-4 sm:size-5" />}
              value={formatSummaryCpa(data.tiktok.cpa, "PEN")}
              changePct={data.tiktok.cpaChangePct}
              subtitle="Costo por compra · PEN (S/)"
            />
            <SummaryPinCard
              title="CPA total"
              icon={<RiFundsLine className="size-4 sm:size-5" />}
              value={formatSummaryCpa(data.total.cpaCop, "COP")}
              changePct={data.total.cpaChangePct}
              subtitle="Gasto total COP ÷ pedidos totales"
            />
          </SummarySection>
        </div>
      ) : null}

      <SummaryProductsTableSection dateRange={dateRange} />
    </div>
  )
}
