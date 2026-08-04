"use client"

import { Cell, Pie, PieChart } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { AudienceSegment } from "@/lib/services/meta/audience-breakdowns"
import { formatAudiencePurchases } from "@/lib/services/meta/audience-breakdowns"

const DONUT_COLORS = [
  "hsl(330 70% 55%)",
  "hsl(217 70% 55%)",
  "hsl(142 55% 45%)",
  "hsl(25 85% 55%)",
  "hsl(262 60% 55%)",
  "hsl(0 70% 55%)",
  "hsl(190 70% 45%)",
  "hsl(45 90% 50%)",
]

function buildChartConfig(segments: AudienceSegment[]): ChartConfig {
  const config: ChartConfig = {}
  for (const segment of segments) {
    config[segment.key] = { label: segment.label }
  }
  return config
}

export function AudienceDonutView({
  segments,
}: {
  segments: AudienceSegment[]
}) {
  if (segments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Sin datos en este periodo.</p>
    )
  }

  const chartData = segments.map((segment, index) => ({
    key: segment.key,
    label: segment.label,
    value: segment.percent,
    purchases: segment.purchases,
    fill: DONUT_COLORS[index % DONUT_COLORS.length],
  }))

  const config = buildChartConfig(segments)

  return (
    <ChartContainer config={config} className="mx-auto aspect-square max-h-[220px] w-full">
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(value, _name, item) => {
                const purchases = Number(item.payload?.purchases ?? 0)
                const ventas =
                  purchases > 0
                    ? ` · ${formatAudiencePurchases(purchases)} ventas`
                    : ""
                return (
                  <span>
                    {item.payload?.label}: {value}%{ventas}
                  </span>
                )
              }}
            />
          }
        />
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="label"
          innerRadius={52}
          outerRadius={78}
          strokeWidth={2}
        >
          {chartData.map((entry, index) => (
            <Cell key={entry.key} fill={entry.fill} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  )
}
