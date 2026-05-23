"use client"

import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import {
  formatCurrency,
  TIKTOK_DASHBOARD_CURRENCY,
  type CurrencyCode,
} from "@/lib/format"
import type { TikTokCampaignDailyInsight } from "@/lib/services/tiktok/campaign-daily-insights"

const chartConfig = {
  spend: {
    label: "Gasto",
    color: "var(--chart-1)",
  },
  purchases: {
    label: "Compras",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

interface TikTokCampaignDetailsChartProps {
  days: Array<Pick<TikTokCampaignDailyInsight, "date" | "spend" | "purchases">>
  currency?: CurrencyCode
  className?: string
}

export function TikTokCampaignDetailsChart({
  days,
  currency = TIKTOK_DASHBOARD_CURRENCY,
  className,
}: TikTokCampaignDetailsChartProps) {
  const data = days.map((day) => ({
    ...day,
    label: format(parseISO(day.date), "EEE d", { locale: es }),
  }))

  return (
    <ChartContainer
      config={chartConfig}
      className={cn("w-full", className ?? "aspect-[16/9]")}
    >
      <ComposedChart data={data} margin={{ left: 4, right: 4, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          fontSize={11}
        />
        <YAxis
          yAxisId="spend"
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          fontSize={11}
          tickFormatter={(v) =>
            v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
          }
        />
        <YAxis
          yAxisId="purchases"
          orientation="right"
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          fontSize={11}
          allowDecimals={false}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => {
                if (name === "spend") {
                  return [
                    formatCurrency(Number(value), currency),
                    "Gasto",
                  ]
                }
                if (name === "purchases") {
                  return [String(value), "Compras"]
                }
                return [String(value), String(name)]
              }}
            />
          }
        />
        <Bar
          yAxisId="spend"
          dataKey="spend"
          fill="var(--color-spend)"
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
        <Line
          yAxisId="purchases"
          type="monotone"
          dataKey="purchases"
          stroke="var(--color-purchases)"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </ComposedChart>
    </ChartContainer>
  )
}
