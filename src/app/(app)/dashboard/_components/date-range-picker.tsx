"use client"

import { useState } from "react"
import { format, isSameDay, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { RiCalendarLine } from "@remixicon/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DateRangeCalendarPanel } from "@/components/date-range-calendar-panel"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { getLastNDaysRange } from "@/lib/date"

interface DateRangePickerProps {
  from: string
  to: string
  onRangeChange: (range: { from: string; to: string }) => void
  className?: string
}

function getRangeLabel(from: string, to: string) {
  const last30 = getLastNDaysRange(30)
  if (from === last30.from && to === last30.to) {
    return "Últimos 30 días"
  }

  const last7 = getLastNDaysRange(7)
  if (from === last7.from && to === last7.to) {
    return "Últimos 7 días"
  }

  const fromDate = parseISO(from)
  const toDate = parseISO(to)
  const today = new Date()

  if (isSameDay(fromDate, today) && isSameDay(toDate, today)) {
    return "Hoy"
  }

  if (isSameDay(fromDate, toDate)) {
    return format(fromDate, "d MMM yyyy", { locale: es })
  }

  return `${format(fromDate, "d MMM yyyy", { locale: es })} – ${format(toDate, "d MMM yyyy", { locale: es })}`
}

export function DateRangePicker({
  from,
  to,
  onRangeChange,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className="h-9 justify-start px-3 text-left font-normal"
          >
            <RiCalendarLine data-icon="inline-start" />
            <span>{getRangeLabel(from, to)}</span>
          </Button>
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
          {open ? (
            <DateRangeCalendarPanel
              from={from}
              to={to}
              onApply={(range) => {
                onRangeChange(range)
                setOpen(false)
              }}
            />
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  )
}
