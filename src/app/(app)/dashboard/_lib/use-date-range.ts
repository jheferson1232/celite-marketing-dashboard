import { parseAsString, useQueryStates } from "nuqs"
import { getDashboardToday } from "@/lib/date"

export function getTodayDateRange() {
  const today = getDashboardToday()
  return { from: today, to: today }
}

const defaultFrom = () => getTodayDateRange().from
const defaultTo = () => getTodayDateRange().to

export function useDateRange() {
  const [dateRange, setDateRange] = useQueryStates(
    {
      from: parseAsString.withDefault(defaultFrom()),
      to: parseAsString.withDefault(defaultTo()),
    },
    {
      shallow: false,
    }
  )

  return { dateRange, setDateRange }
}
