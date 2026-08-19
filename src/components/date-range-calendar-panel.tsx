"use client"

import { useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import { es as dateFnsEs } from "date-fns/locale"
import { es } from "react-day-picker/locale"
import type { DateRange as DateRangeType } from "react-day-picker"
import { RiArrowDownSLine } from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  getDashboardToday,
  getLastNDaysRange,
  getMonthRange,
} from "@/lib/date"

const RECENT_MONTH_COUNT = 12

function rangeToDraft(from: string, to: string): DateRangeType {
  return { from: parseISO(from), to: parseISO(to) }
}

function draftToRange(draft: DateRangeType): { from: string; to: string } | null {
  if (!draft.from || !draft.to) return null
  return {
    from: format(draft.from, "yyyy-MM-dd"),
    to: format(draft.to, "yyyy-MM-dd"),
  }
}

function isSameRange(
  draft: DateRangeType,
  range: { from: string; to: string }
): boolean {
  const current = draftToRange(draft)
  return current?.from === range.from && current?.to === range.to
}

function getRecentMonthOptions() {
  const today = getDashboardToday()
  const [year, month] = today.split("-").map(Number)
  return Array.from({ length: RECENT_MONTH_COUNT }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - index, 1, 12))
    const optionYear = date.getUTCFullYear()
    const optionMonth = date.getUTCMonth() + 1
    const range = getMonthRange(optionYear, optionMonth)
    return {
      id: `${optionYear}-${optionMonth}`,
      label: format(date, "MMMM yyyy", { locale: dateFnsEs }),
      ...range,
    }
  })
}

interface DateRangeCalendarPanelProps {
  from: string
  to: string
  onApply: (range: { from: string; to: string }) => void
}

export function DateRangeCalendarPanel({
  from,
  to,
  onApply,
}: DateRangeCalendarPanelProps) {
  const [draft, setDraft] = useState<DateRangeType>(() => rangeToDraft(from, to))
  const [visibleMonth, setVisibleMonth] = useState(() => parseISO(from))
  const today = parseISO(getDashboardToday())
  const last30 = getLastNDaysRange(30)
  const last7 = getLastNDaysRange(7)
  const months = useMemo(() => getRecentMonthOptions(), [])
  const last30Active = isSameRange(draft, last30)
  const last7Active = isSameRange(draft, last7)
  const activeMonthId = months.find((month) => isSameRange(draft, month))?.id
  const canApply = Boolean(draft.from && draft.to)

  function applyPreset(range: { from: string; to: string }) {
    setDraft(rangeToDraft(range.from, range.to))
    setVisibleMonth(parseISO(range.from))
  }

  function handleApply() {
    const range = draftToRange(draft)
    if (!range) return
    onApply(range)
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant={activeMonthId ? "default" : "outline"}
              size="sm"
            >
              Meses
              <RiArrowDownSLine data-icon="inline-end" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-auto min-w-44">
            <DropdownMenuGroup>
              {months.map((month) => (
                <DropdownMenuItem
                  key={month.id}
                  onSelect={() => applyPreset(month)}
                >
                  {month.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          type="button"
          variant={last30Active ? "default" : "outline"}
          size="sm"
          onClick={() => applyPreset(last30)}
        >
          Últimos 30 días
        </Button>
        <Button
          type="button"
          variant={last7Active ? "default" : "outline"}
          size="sm"
          onClick={() => applyPreset(last7)}
        >
          Últimos 7 días
        </Button>
      </div>

      <Calendar
        mode="range"
        locale={es}
        month={visibleMonth}
        onMonthChange={setVisibleMonth}
        selected={draft}
        onSelect={(range) => setDraft(range ?? { from: undefined, to: undefined })}
        numberOfMonths={2}
        disabled={{ after: today }}
        className="p-0"
      />

      <div className="flex justify-end">
        <Button type="button" size="sm" disabled={!canApply} onClick={handleApply}>
          Aplicar
        </Button>
      </div>
    </div>
  )
}
