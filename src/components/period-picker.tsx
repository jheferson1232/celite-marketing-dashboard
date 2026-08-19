"use client"

import { useState, type ReactNode } from "react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import {
  getDashboardToday,
  getDashboardYesterday,
  getLastNDaysRange,
} from "@/lib/date"
import { DateRangeCalendarPanel } from "@/components/date-range-calendar-panel"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type PeriodId = "today" | "yesterday" | "last3" | "last7" | "last15" | "last30"

const PERIODS: { id: PeriodId; label: string }[] = [
  { id: "today", label: "Hoy" },
  { id: "yesterday", label: "Ayer" },
  { id: "last3", label: "3 días" },
  { id: "last7", label: "7 días" },
  { id: "last15", label: "15 días" },
  { id: "last30", label: "30 días" },
]

function rangeForPeriod(id: PeriodId): { from: string; to: string } {
  switch (id) {
    case "today": {
      const today = getDashboardToday()
      return { from: today, to: today }
    }
    case "yesterday": {
      const yesterday = getDashboardYesterday()
      return { from: yesterday, to: yesterday }
    }
    case "last3":
      return getLastNDaysRange(3)
    case "last7":
      return getLastNDaysRange(7)
    case "last15":
      return getLastNDaysRange(15)
    case "last30":
      return getLastNDaysRange(30)
  }
}

function matchPeriod(from: string, to: string): PeriodId | null {
  for (const { id } of PERIODS) {
    const range = rangeForPeriod(id)
    if (range.from === from && range.to === to) return id
  }
  return null
}

function customLabel(from: string, to: string): string {
  if (from === to) {
    return format(parseISO(from), "d MMM", { locale: es })
  }
  return `${format(parseISO(from), "d MMM", { locale: es })} – ${format(parseISO(to), "d MMM", { locale: es })}`
}

interface PeriodPickerProps {
  from: string
  to: string
  onRangeChange: (range: { from: string; to: string }) => void
  /** Controles a la derecha de Personalizado (p. ej. Reload). */
  endAction?: ReactNode
  className?: string
}

export function PeriodPicker({
  from,
  to,
  onRangeChange,
  endAction,
  className,
}: PeriodPickerProps) {
  const [customOpen, setCustomOpen] = useState(false)
  const activePeriod = matchPeriod(from, to)
  const isCustom = activePeriod === null

  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-2 sm:gap-3",
        className
      )}
    >
      <span className="shrink-0 text-sm text-muted-foreground">Periodo:</span>

      <div
        role="group"
        aria-label="Periodo"
        className="inline-flex max-w-full items-center overflow-x-auto rounded-lg bg-muted p-1"
      >
        {PERIODS.map(({ id, label }) => {
          const isActive = activePeriod === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onRangeChange(rangeForPeriod(id))}
              aria-pressed={isActive}
              className={cn(
                "shrink-0 rounded-md px-2.5 py-1.5 text-sm transition-colors sm:px-3",
                isActive
                  ? "bg-background font-semibold text-foreground shadow-sm"
                  : "font-normal text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          )
        })}
      </div>

      <Popover open={customOpen} onOpenChange={setCustomOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-pressed={isCustom}
            className={cn(
              "shrink-0 rounded-lg border border-transparent bg-background px-3 py-1.5 text-sm shadow-sm transition-colors",
              isCustom
                ? "font-semibold text-foreground ring-1 ring-border"
                : "font-normal text-muted-foreground hover:text-foreground"
            )}
          >
            {isCustom ? customLabel(from, to) : "Personalizado"}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto gap-0 p-0"
          align="start"
          onInteractOutside={(event) => {
            const target = event.target as HTMLElement | null
            if (target?.closest("[data-slot=dropdown-menu-content]")) {
              event.preventDefault()
            }
          }}
        >
          {customOpen ? (
            <DateRangeCalendarPanel
              from={from}
              to={to}
              onApply={(range) => {
                onRangeChange(range)
                setCustomOpen(false)
              }}
            />
          ) : null}
        </PopoverContent>
      </Popover>

      {endAction}
    </div>
  )
}
