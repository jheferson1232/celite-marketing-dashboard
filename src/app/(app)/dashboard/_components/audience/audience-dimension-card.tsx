"use client"

import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { AudienceDimension } from "@/lib/services/meta/audience-breakdowns"
import {
  formatAudienceSpend,
  isGoodAudienceCoverage,
} from "@/lib/services/meta/audience-breakdowns"
import { AudienceBarsView } from "./audience-bars-view"
import { AudienceDonutView } from "./audience-donut-view"
import { AudienceTableView } from "./audience-table-view"

type ViewMode = "bars" | "table" | "donut"

export function AudienceDimensionCard({
  dimension,
  viewMode,
  icon,
}: {
  dimension: AudienceDimension
  viewMode: ViewMode
  icon: ReactNode
}) {
  const classified = dimension.classifiedPurchases ?? 0
  const total = dimension.totalPurchases
  const goodCoverage =
    dimension.showCoverage && isGoodAudienceCoverage(classified, total)

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <h3 className="text-sm font-semibold">{dimension.title}</h3>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {dimension.showCoverage ? (
            <>
              <span className="text-xs tabular-nums text-muted-foreground">
                {classified}/{total} clasif.
              </span>
              <Badge
                variant="secondary"
                className={cn(
                  "text-[10px]",
                  goodCoverage
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                )}
              >
                {goodCoverage ? "Buena cobertura" : "Cobertura baja"}
              </Badge>
            </>
          ) : (
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {formatAudienceSpend(dimension.totalSpend)}
            </span>
          )}
        </div>
      </div>

      {viewMode === "bars" ? (
        <AudienceBarsView
          segments={dimension.segments}
          cpaAvailable={dimension.cpaAvailable}
        />
      ) : null}
      {viewMode === "table" ? (
        <AudienceTableView
          segments={dimension.segments}
          cpaAvailable={dimension.cpaAvailable}
        />
      ) : null}
      {viewMode === "donut" ? (
        <AudienceDonutView segments={dimension.segments} />
      ) : null}

      {dimension.coverageNote ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          {dimension.coverageNote}
        </p>
      ) : null}
    </section>
  )
}
