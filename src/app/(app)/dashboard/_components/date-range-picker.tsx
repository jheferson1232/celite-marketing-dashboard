"use client"

import * as React from "react"
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

interface DateRangePickerProps {
  from: string
  to: string
  onRangeChange: (range: { from: string; to: string }) => void
  className?: string
}

function getRangeLabel(from: string, to: string) {
  const fromDate = parseISO(from)
  const toDate = parseISO(to)
  const today = new Date()

  if (isSameDay(fromDate, today) && isSameDay(toDate, today)) {
    return "Hoy"
  }

  if (isSameDay(fromDate, toDate)) {
    return format(fromDate, "LLL dd, y")
  }

  return `${format(fromDate, "LLL dd, y")} - ${format(toDate, "LLL dd, y")}`
}

export function DateRangePicker({
  from,
  to,
  onRangeChange,
  className,
}: DateRangePickerProps) {
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

  const setPreset = (preset: string) => {
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
      case "last7":
        newFrom = subDays(new Date(), 7)
        break
      case "last30":
        newFrom = subDays(new Date(), 30)
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
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              "h-9 justify-start gap-2 px-3 text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <RiCalendarLine className="size-4 shrink-0" />
            {date?.from && date?.to ? (
              <span>{getRangeLabel(from, to)}</span>
            ) : (
              <span>Seleccionar fecha</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex flex-col sm:flex-row">
            <div className="flex flex-col gap-1 border-r p-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreset("today")}
                className="justify-start"
              >
                Hoy
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreset("yesterday")}
                className="justify-start"
              >
                Ayer
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreset("last7")}
                className="justify-start"
              >
                Últimos 7 días
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreset("last30")}
                className="justify-start"
              >
                Últimos 30 días
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreset("thisMonth")}
                className="justify-start"
              >
                Este mes
              </Button>
            </div>
            <Calendar
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={handleSelect}
              numberOfMonths={2}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
