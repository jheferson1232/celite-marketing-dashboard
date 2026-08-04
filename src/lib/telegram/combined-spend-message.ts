import {
  formatCurrency,
  META_DASHBOARD_CURRENCY,
  TIKTOK_DASHBOARD_CURRENCY,
} from "@/lib/format"
import { getAccountKpis } from "@/lib/services/meta/account-kpis"
import type { DateRange } from "@/lib/services/meta/types"
import { getTikTokAllAccountsKpis } from "@/lib/services/tiktok/account-kpis"

function formatPlatformBlock(
  platformLabel: string,
  spend: number,
  purchases: number,
  cpa: number,
  currency: typeof META_DASHBOARD_CURRENCY | typeof TIKTOK_DASHBOARD_CURRENCY
): string {
  const spendFormatted = formatCurrency(spend, currency)
  const cpaFormatted =
    purchases > 0 ? formatCurrency(cpa, currency) : "—"

  return (
    `**${platformLabel}**\n` +
    `- **Gasto total:** ${spendFormatted}\n` +
    `- **Compras:** ${purchases}\n` +
    `- **CPA:** ${cpaFormatted}`
  )
}

/** Gasto de Meta (Facebook) + TikTok en el mismo rango (monedas separadas). */
export async function formatCombinedSpendMessage(
  dateRange: DateRange,
  periodLabel: string
): Promise<string> {
  const [meta, tiktok] = await Promise.all([
    getAccountKpis(dateRange),
    getTikTokAllAccountsKpis(dateRange),
  ])

  const metaBlock = formatPlatformBlock(
    "Facebook (Meta)",
    meta.totalSpend,
    meta.purchases,
    meta.cpa,
    META_DASHBOARD_CURRENCY
  )

  const tiktokBlock = formatPlatformBlock(
    "TikTok",
    tiktok.spendPen,
    tiktok.purchases,
    tiktok.cpaPen,
    TIKTOK_DASHBOARD_CURRENCY
  )

  return `**Gasto total — ${periodLabel}**\n\n${metaBlock}\n\n${tiktokBlock}`
}
