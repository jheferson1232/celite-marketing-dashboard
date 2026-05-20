import { formatCurrency, META_DASHBOARD_CURRENCY } from "@/lib/format"
import type { DateRange } from "@/lib/services/meta/types"
import { getCampaignsList } from "@/lib/services/meta/campaigns-list"
import {
  addDaysToDateString,
  getDashboardToday,
  getDashboardYesterday,
} from "@/lib/date"

function cop(amount: number): string {
  return formatCurrency(amount, META_DASHBOARD_CURRENCY)
}

export function parseMetaDateRangeArg(arg?: string): DateRange {
  const today = getDashboardToday()
  const normalized = (arg ?? "hoy").toLowerCase().trim()

  if (normalized === "ayer") {
    const y = getDashboardYesterday()
    return { from: y, to: y }
  }
  return { from: today, to: today }
}

/** Campañas Facebook (Meta) activas con gasto y compras del rango. */
export async function formatMetaActiveCampaignsMessage(
  dateRange: DateRange,
  periodLabel = "hoy"
): Promise<string> {
  const campaigns = await getCampaignsList(dateRange)
  const active = campaigns
    .filter((c) => c.status === "ACTIVE")
    .sort((a, b) => b.spend - a.spend || a.name.localeCompare(b.name))
    .slice(0, 25)

  if (active.length === 0) {
    return `**Facebook — campañas activas (${periodLabel})**\n\nNo hay campañas activas en este periodo.`
  }

  const lines = active.map((c) => {
    const compras =
      c.results > 0 ? `${c.results} compra${c.results === 1 ? "" : "s"}` : "0 compras"
    return `🟢 **${c.name}**\n   Gasto ${cop(c.spend)} · ${compras}`
  })

  const totalSpend = active.reduce((sum, c) => sum + c.spend, 0)
  const totalPurchases = active.reduce((sum, c) => sum + c.results, 0)

  return (
    `**Facebook — campañas activas (${periodLabel})**\n` +
    `${active.length} campaña${active.length === 1 ? "" : "s"} · ` +
    `Gasto ${cop(totalSpend)} · ${totalPurchases} compras\n\n` +
    lines.join("\n\n")
  )
}
