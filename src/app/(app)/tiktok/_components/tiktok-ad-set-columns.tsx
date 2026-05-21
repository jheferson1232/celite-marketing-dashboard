import type { CampaignAdSetRow } from "@/lib/services/meta/types"
import {
  formatCurrency,
  TIKTOK_DASHBOARD_CURRENCY,
  type CurrencyCode,
} from "@/lib/format"
import { cn } from "@/lib/utils"
import type { CampaignColumnMeta } from "@/app/(app)/dashboard/_components/campaigns/types"
import {
  getAdSetSubtableColumnMeta,
  getAdSetSubtableColumnsWithTikTokManage,
  type AdSetSubtableColumnId,
  type TikTokAdSetManageColumnId,
} from "@/app/(app)/dashboard/_components/campaigns/ad-set-subtable-columns"
import { formatNumber, getCostPerResultCellClassName } from "@/app/(app)/dashboard/_components/campaigns/utils"

export const TIKTOK_AD_SET_METRIC_COLUMN_IDS = [
  "purchases7d",
  "cpa7d",
  "totalPurchases",
  "totalCpa",
] as const

export type TikTokAdSetMetricColumnId =
  (typeof TIKTOK_AD_SET_METRIC_COLUMN_IDS)[number]

export type TikTokAdSetDisplayColumnId =
  | AdSetSubtableColumnId
  | TikTokAdSetManageColumnId
  | TikTokAdSetMetricColumnId

const TIKTOK_AD_SET_METRIC_COLUMN_META: Record<
  TikTokAdSetMetricColumnId,
  CampaignColumnMeta
> = {
  purchases7d: { label: "Compras 7d", align: "right" },
  cpa7d: { label: "CPA 7d", align: "right" },
  totalPurchases: { label: "Total compras", align: "right" },
  totalCpa: { label: "CPA total", align: "right" },
}

export function isTikTokAdSetMetricColumnId(
  columnId: string
): columnId is TikTokAdSetMetricColumnId {
  return TIKTOK_AD_SET_METRIC_COLUMN_IDS.includes(
    columnId as TikTokAdSetMetricColumnId
  )
}

/** Sin Agreg. carrito; añade métricas 7d y totales tras Costo/Res. */
export function getTikTokAdSetDisplayColumns(
  visibleSubtableColumns: AdSetSubtableColumnId[]
): TikTokAdSetDisplayColumnId[] {
  const withoutRoas = visibleSubtableColumns.filter((id) => id !== "roas")
  const base = getAdSetSubtableColumnsWithTikTokManage(withoutRoas, true)
  const out: TikTokAdSetDisplayColumnId[] = []

  for (const columnId of base) {
    out.push(columnId)
    if (columnId === "costPerResult") {
      out.push(
        "purchases7d",
        "cpa7d",
        "totalPurchases",
        "totalCpa"
      )
    }
  }

  return out
}

export function getTikTokAdSetColumnMeta(
  columnId: TikTokAdSetDisplayColumnId,
  currency: CurrencyCode = TIKTOK_DASHBOARD_CURRENCY
): CampaignColumnMeta {
  if (isTikTokAdSetMetricColumnId(columnId)) {
    return TIKTOK_AD_SET_METRIC_COLUMN_META[columnId]
  }

  if (columnId === "results") {
    return { label: "Compras", align: "right" }
  }
  if (columnId === "costPerResult") {
    return { label: "CPA", align: "right" }
  }

  return getAdSetSubtableColumnMeta(columnId, currency)
}

export function renderTikTokAdSetMetricCell(
  columnId: TikTokAdSetMetricColumnId,
  row: CampaignAdSetRow,
  currency: CurrencyCode = TIKTOK_DASHBOARD_CURRENCY
) {
  switch (columnId) {
    case "purchases7d": {
      const n = row.purchases7d ?? 0
      return (
        <div className="text-right">
          {n > 0 ? formatNumber(n) : "-"}
        </div>
      )
    }
    case "cpa7d": {
      const cpa = row.cpa7d ?? 0
      const highlight = getCostPerResultCellClassName(cpa, currency)
      return (
        <div className={cn("-m-2 p-2 text-right", highlight)}>
          {cpa > 0 ? formatCurrency(cpa, currency) : "-"}
        </div>
      )
    }
    case "totalPurchases": {
      const n = row.totalPurchases ?? 0
      return (
        <div className="text-right font-medium">
          {n > 0 ? formatNumber(n) : "-"}
        </div>
      )
    }
    case "totalCpa": {
      const cpa = row.totalCpa ?? 0
      const highlight = getCostPerResultCellClassName(cpa, currency)
      return (
        <div className={cn("-m-2 p-2 text-right", highlight)}>
          {cpa > 0 ? formatCurrency(cpa, currency) : "-"}
        </div>
      )
    }
  }
}
