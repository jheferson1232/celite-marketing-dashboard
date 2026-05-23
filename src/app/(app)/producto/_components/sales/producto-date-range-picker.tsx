"use client"

import {
  format,
  isSameDay,
  parseISO,
  subDays,
  startOfMonth,
  endOfMonth,
} from "date-fns"
import { RiCalendarLine } from "@remixicon/react"
import type { DateRange as DateRangeType } from "react-day-picker"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { getLastSevenDaysRange } from "@/lib/services/tiktok/campaign-daily-insights"

interface ProductoDateRangePickerProps {
  from: string
  to: string
  onRangeChange: (range: { from: string; to: string }) => void
  className?: string
}

function isLastSevenDays(from: string, to: string): boolean {
  const preset = getLastSevenDaysRange()
  return from === preset.from && to === preset.to
}

function getRangeLabel(from: string, to: string) {
  if (isLastSevenDays(from, to)) {
    return "Últimos 7 días"
  }

  const fromDate = parseISO(from)
  const toDate = parseISO(to)
  const today = new Date()

  if (isSameDay(fromDate, today) && isSameDay(toDate, today)) {
    return "Hoy"
  }

  if (isSameDay(fromDate, toDate)) {
    return format(fromDate, "d MMM", { locale: undefined })
  }

  return `${format(fromDate, "d MMM")} – ${format(toDate, "d MMM")}`
}

const PRESETS = [
  { id: "today", label: "Hoy" },
  { id: "yesterday", label: "Ayer" },
  { id: "last7", label: "Últimos 7 días" },
  { id: "last30", label: "Últimos 30 días" },
  { id: "thisMonth", label: "Este mes" },
] as const

export function ProductoDateRangePicker({
  from,
  to,
  onRangeChange,
  className,
}: ProductoDateRangePickerProps) {
  const date: DateRangeType = {
    from: parseISO(from),
    to: parseISO(to),
  }

  const handleSelect = (range: DateRangeType | undefined) => {
    if (range?.from && range?.to) {
      onRangeChange({
        from: format(range.from, "yyyy-MM-dd"),
        to: format(range.to, "yyyy-MM-dd"),
      })
    }
  }

  const setPreset = (preset: (typeof PRESETS)[number]["id"]) => {
    let newFrom: Date
    let newTo = new Date()

    switch (preset) {
      case "today":
        newFrom = new Date()
        break
      case "yesterday":
        newFrom = subDays(new Date(), 1)
        newTo = subDays(new Date(), 1)
        break
      case "last7": {
        const r = getLastSevenDaysRange()
        onRangeChange(r)
        return
      }
      case "last30":
        newFrom = subDays(new Date(), 29)
        break
      case "thisMonth":
        newFrom = startOfMonth(new Date())
        newTo = endOfMonth(new Date())
        break
      default:
        return
    }

    onRangeChange({
      from: format(newFrom, "yyyy-MM-dd"),
      to: format(newTo, "yyyy-MM-dd"),
    })
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-7 gap-1.5 px-2 text-xs font-normal",
            isLastSevenDays(from, to) && "border-primary/50 bg-primary/5",
            className
          )}
        >
          <RiCalendarLine className="size-3.5 shrink-0" />
          <span className="truncate">{getRangeLabel(from, to)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex max-w-[min(100vw-1.5rem,320px)] flex-col sm:max-w-none sm:flex-row">
          <div className="flex flex-col gap-0.5 border-b p-1.5 sm:border-b-0 sm:border-r">
            {PRESETS.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPreset(preset.id)}
                className={cn(
                  "h-7 justify-start px-2 text-xs",
                  preset.id === "last7" &&
                    isLastSevenDays(from, to) &&
                    "bg-muted font-medium"
                )}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <Calendar
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={handleSelect}
            numberOfMonths={1}
            className="p-2"
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
