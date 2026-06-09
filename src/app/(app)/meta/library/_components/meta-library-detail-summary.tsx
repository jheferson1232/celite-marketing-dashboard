"use client"

import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { MetaLibraryAnalytics } from "@/lib/services/meta/library/meta-library-analytics"

const chartConfig = {
  active: {
    label: "Activos",
    color: "hsl(142 71% 45%)",
  },
} satisfies ChartConfig

export function MetaLibraryDetailSummary({
  activeCount,
  totalCount,
  analytics,
}: {
  activeCount: number
  totalCount: number
  analytics: MetaLibraryAnalytics
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Resumen de anuncios Meta</h2>
            <p className="text-emerald-600 text-sm font-medium">
              {activeCount} Anuncios activos
            </p>
          </div>
          <p className="text-muted-foreground text-sm">
            {totalCount} anuncios totales
          </p>
        </div>

        {analytics.timeline.length > 0 ? (
          <ChartContainer config={chartConfig} className="aspect-[16/7] w-full">
            <LineChart data={analytics.timeline} margin={{ left: 0, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={11}
                interval="preserveStartEnd"
              />
              <YAxis tickLine={false} axisLine={false} fontSize={11} width={28} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="active"
                stroke="var(--color-active)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        ) : (
          <p className="text-muted-foreground py-12 text-center text-sm">
            Sin datos de línea de tiempo para estos anuncios.
          </p>
        )}
      </div>

      <div className="flex flex-col items-center justify-center rounded-2xl border bg-card p-6 shadow-sm">
        <div className="relative flex size-32 items-center justify-center">
          <svg className="size-full -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="currentColor"
              className="text-muted/30"
              strokeWidth="10"
            />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="currentColor"
              className="text-emerald-500"
              strokeWidth="10"
              strokeDasharray={`${(analytics.survivalRate / 100) * 327} 327`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute text-center">
            <p className="text-2xl font-bold">{activeCount}</p>
            <p className="text-muted-foreground text-xs">Activos</p>
          </div>
        </div>
        <p className="mt-3 text-center text-sm">
          Tasa de supervivencia{" "}
          <span className="font-semibold">{analytics.survivalRate}%</span>
        </p>
      </div>
    </div>
  )
}
