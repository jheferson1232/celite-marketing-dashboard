import { parseAsString, useQueryStates } from "nuqs"
import { getLastSevenDaysRange } from "@/lib/services/tiktok/campaign-daily-insights.shared"

function defaultRange() {
  return getLastSevenDaysRange()
}

/** Rango de fechas del producto (URL `pfrom`/`pto`), por defecto últimos 7 días. */
export function useProductoDateRange() {
  const initial = defaultRange()
  const [state, setState] = useQueryStates(
    {
      pfrom: parseAsString.withDefault(initial.from),
      pto: parseAsString.withDefault(initial.to),
    },
    { shallow: false }
  )

  return {
    dateRange: { from: state.pfrom, to: state.pto },
    setDateRange: (range: { from: string; to: string }) =>
      setState({ pfrom: range.from, pto: range.to }),
  }
}
