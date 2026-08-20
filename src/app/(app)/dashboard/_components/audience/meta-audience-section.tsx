"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  RiArrowDownSLine,
  RiArrowRightSLine,
  RiBarChart2Line,
  RiDeviceLine,
  RiMapPinLine,
  RiPieChart2Line,
  RiShareLine,
  RiStackLine,
  RiTableLine,
  RiUser3Line,
} from "@remixicon/react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { getLastNDaysRange } from "@/lib/date"
import { runServerAction } from "@/lib/server-action"
import { getAudienceBreakdownsAction } from "../../_actions/audience-breakdowns"
import { AudienceDimensionCard } from "./audience-dimension-card"

type ViewMode = "bars" | "table" | "donut"
type PeriodDays = 3 | 7 | 15 | 30

const VIEW_OPTIONS: {
  id: ViewMode
  label: string
  icon: typeof RiBarChart2Line
}[] = [
  { id: "bars", label: "Barras", icon: RiBarChart2Line },
  { id: "table", label: "Tabla", icon: RiTableLine },
  { id: "donut", label: "Dona", icon: RiPieChart2Line },
]

const PERIOD_OPTIONS: PeriodDays[] = [3, 7, 15, 30]

function AudienceSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-56 rounded-xl" />
      ))}
    </div>
  )
}

export function MetaAudienceSection() {
  const [open, setOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>("bars")
  const [periodDays, setPeriodDays] = useState<PeriodDays>(7)

  const dateRange = getLastNDaysRange(periodDays)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["meta-audience-breakdowns", periodDays],
    queryFn: () => runServerAction(getAudienceBreakdownsAction(dateRange)),
    enabled: open,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-muted/40"
      >
        <span className="mt-0.5 shrink-0 text-muted-foreground">
          {open ? (
            <RiArrowDownSLine className="size-5" />
          ) : (
            <RiArrowRightSLine className="size-5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <RiUser3Line className="size-5 shrink-0 text-violet-600 dark:text-violet-400" />
            <h2 className="text-lg font-semibold tracking-tight">
              ¿A quién le estás vendiendo? — Meta
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Distribución Meta Insights · últimos {periodDays} días
          </p>
        </div>
      </button>

      {open ? (
        <div className="flex flex-col gap-4 border-t px-4 pt-4 pb-4">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div
              role="group"
              aria-label="Vista"
              className="inline-flex items-center rounded-lg bg-muted p-1"
            >
              {VIEW_OPTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setViewMode(id)}
                  aria-pressed={viewMode === id}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    viewMode === id
                      ? "bg-background font-semibold text-foreground shadow-sm"
                      : "font-normal text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="size-3.5" />
                  {label}
                </button>
              ))}
            </div>

            <div
              role="group"
              aria-label="Periodo audiencia"
              className="inline-flex items-center rounded-lg bg-muted p-1"
            >
              {PERIOD_OPTIONS.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setPeriodDays(days)}
                  aria-pressed={periodDays === days}
                  className={cn(
                    "shrink-0 rounded-md px-2.5 py-1.5 text-sm transition-colors sm:px-3",
                    periodDays === days
                      ? "bg-background font-semibold text-foreground shadow-sm"
                      : "font-normal text-muted-foreground hover:text-foreground"
                  )}
                >
                  {days}d
                </button>
              ))}
            </div>
          </div>

          {isError ? (
            <p className="text-sm text-destructive">
              {error?.message ?? "No se pudo cargar la audiencia Meta."}
            </p>
          ) : null}

          {isLoading ? (
            <AudienceSkeleton />
          ) : data ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <AudienceDimensionCard
                dimension={data.dimensions.gender}
                viewMode={viewMode}
                icon={<RiUser3Line className="size-4" />}
              />
              <AudienceDimensionCard
                dimension={data.dimensions.age}
                viewMode={viewMode}
                icon={<RiBarChart2Line className="size-4" />}
              />
              <AudienceDimensionCard
                dimension={data.dimensions.device}
                viewMode={viewMode}
                icon={<RiDeviceLine className="size-4" />}
              />
              <AudienceDimensionCard
                dimension={data.dimensions.platform}
                viewMode={viewMode}
                icon={<RiStackLine className="size-4" />}
              />
              <AudienceDimensionCard
                dimension={data.dimensions.network}
                viewMode={viewMode}
                icon={<RiShareLine className="size-4" />}
              />
              <AudienceDimensionCard
                dimension={data.dimensions.region}
                viewMode={viewMode}
                icon={<RiMapPinLine className="size-4" />}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
