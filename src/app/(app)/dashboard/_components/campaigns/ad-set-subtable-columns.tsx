import type { VisibilityState } from "@tanstack/react-table"
import type { CampaignAdSetRow } from "@/lib/services/meta/types"
import { isMetaAdSetActiveForCount } from "@/lib/services/meta/meta-adset-status"
import {
  formatCurrency,
  META_DASHBOARD_CURRENCY,
  TIKTOK_DASHBOARD_CURRENCY,
  type CurrencyCode,
} from "@/lib/format"
import { cn } from "@/lib/utils"
import type { CampaignColumnMeta } from "./types"
import { formatNumber, formatPercent, getCostPerResultCellClassName } from "./utils"

export const TIKTOK_AD_SET_MANAGE_COLUMN_IDS = ["active", "budget"] as const

export type TikTokAdSetManageColumnId =
  (typeof TIKTOK_AD_SET_MANAGE_COLUMN_IDS)[number]

export const AD_SET_SUBTABLE_COLUMN_IDS = [
  "name",
  "spend",
  "impressions",
  "ctr",
  "cpc",
  "results",
  "costPerResult",
  "roas",
  "purchases7d",
  "cpa7d",
  "totalPurchases",
  "totalSpend",
  "totalCpa",
] as const

export type AdSetSubtableColumnId = (typeof AD_SET_SUBTABLE_COLUMN_IDS)[number]

const TIKTOK_AD_SET_MANAGE_COLUMN_META: Record<
  TikTokAdSetManageColumnId,
  CampaignColumnMeta
> = {
  active: { label: "Act.", align: "left" },
  budget: { label: "Presupuesto", align: "right" },
}

const AD_SET_SUBTABLE_COLUMN_META: Record<
  AdSetSubtableColumnId,
  CampaignColumnMeta
> = {
  name: { label: "Nombre", align: "left" },
  spend: { label: "Gasto", align: "right" },
  impressions: { label: "Impresiones", align: "right" },
  ctr: { label: "CTR", align: "right" },
  cpc: { label: "CPC", align: "right" },
  results: { label: "Resultados", align: "right" },
  costPerResult: { label: "Costo/Res", align: "right" },
  roas: { label: "ROAS", align: "right" },
  purchases7d: { label: "Ventas 7d", align: "right" },
  cpa7d: { label: "CPA 7d", align: "right" },
  totalPurchases: { label: "Total ventas", align: "right" },
  totalSpend: { label: "Gasto total", align: "right" },
  totalCpa: { label: "CPA total", align: "right" },
}

function isSubtableColumnId(columnId: string): columnId is AdSetSubtableColumnId {
  return AD_SET_SUBTABLE_COLUMN_IDS.includes(columnId as AdSetSubtableColumnId)
}

export function getVisibleAdSetSubtableColumns(
  visibleColumnOrder: string[],
  columnVisibility: VisibilityState
) {
  return visibleColumnOrder.filter((columnId): columnId is AdSetSubtableColumnId => {
    if (!isSubtableColumnId(columnId)) return false
    return columnVisibility[columnId] !== false
  })
}

export function isTikTokAdSetManageColumnId(
  columnId: string
): columnId is TikTokAdSetManageColumnId {
  return TIKTOK_AD_SET_MANAGE_COLUMN_IDS.includes(
    columnId as TikTokAdSetManageColumnId
  )
}

export function getAdSetSubtableColumnMeta(
  columnId: AdSetSubtableColumnId | TikTokAdSetManageColumnId,
  currency: CurrencyCode = META_DASHBOARD_CURRENCY,
  usePurchaseLabels = false
) {
  if (isTikTokAdSetManageColumnId(columnId)) {
    return TIKTOK_AD_SET_MANAGE_COLUMN_META[columnId]
  }
  if (columnId === "roas") {
    return { label: "Agreg. carrito", align: "right" as const }
  }
  if (columnId === "results" && usePurchaseLabels) {
    return { label: "Compras", align: "right" as const }
  }
  if (columnId === "costPerResult" && usePurchaseLabels) {
    return { label: "CPA", align: "right" as const }
  }
  return AD_SET_SUBTABLE_COLUMN_META[columnId]
}

export function getAdSetSubtableColumnsWithTikTokManage(
  visibleSubtableColumns: AdSetSubtableColumnId[],
  enableTikTokManage: boolean
): (AdSetSubtableColumnId | TikTokAdSetManageColumnId)[] {
  if (!enableTikTokManage) return visibleSubtableColumns

  const withBudgetAfterImpressions: (
    | AdSetSubtableColumnId
    | TikTokAdSetManageColumnId
  )[] = ["active"]

  for (const columnId of visibleSubtableColumns) {
    withBudgetAfterImpressions.push(columnId)
    if (columnId === "impressions") {
      withBudgetAfterImpressions.push("budget")
    }
  }

  return withBudgetAfterImpressions
}

export function renderAdSetSubtableCell(
  columnId: AdSetSubtableColumnId,
  row: CampaignAdSetRow,
  currency: CurrencyCode = META_DASHBOARD_CURRENCY,
  usePurchaseLabels = false
) {
  switch (columnId) {
    case "name":
      return (
        <div className="flex items-center gap-2 pl-2 font-medium">
          <div
            className={cn(
              "h-2 w-2 rounded-full",
              isMetaAdSetActiveForCount({
                status: row.status,
                effective_status: row.adSetEffectiveStatus,
              })
                ? "bg-blue-500"
                : "bg-gray-400"
            )}
          />
          <span>{row.name}</span>
        </div>
      )
    case "spend":
      return (
        <div className="text-right">
          {formatCurrency(row.spend, currency)}
        </div>
      )
    case "impressions":
      return (
        <div className="text-right">{formatNumber(row.impressions)}</div>
      )
    case "ctr":
      return (
        <div className="text-right text-red-500">{formatPercent(row.ctr)}</div>
      )
    case "cpc":
      return (
        <div className="text-right">
          {formatCurrency(row.cpc, currency)}
        </div>
      )
    case "results":
      return (
        <div className="text-right">
          {row.results > 0 ? formatNumber(row.results) : "-"}
        </div>
      )
    case "costPerResult": {
      const highlight = getCostPerResultCellClassName(
        row.costPerResult,
        currency
      )
      return (
        <div
          className={cn("-m-2 p-2 text-right", highlight)}
        >
          {row.costPerResult > 0
            ? formatCurrency(row.costPerResult, currency)
            : "-"}
        </div>
      )
    }
    case "roas":
      return (
        <div className="text-right">
          {(row.addToCart ?? 0) > 0 ? formatNumber(row.addToCart ?? 0) : "-"}
        </div>
      )
    case "purchases7d":
      return (
        <div className="text-right">
          {(row.purchases7d ?? 0) > 0
            ? formatNumber(row.purchases7d ?? 0)
            : "-"}
        </div>
      )
    case "cpa7d": {
      const cpa7d = row.cpa7d ?? 0
      const highlight = getCostPerResultCellClassName(cpa7d, currency)
      return (
        <div className={cn("-m-2 p-2 text-right", highlight)}>
          {cpa7d > 0 ? formatCurrency(cpa7d, currency) : "-"}
        </div>
      )
    }
    case "totalPurchases":
      return (
        <div className="text-right font-medium">
          {(row.totalPurchases ?? 0) > 0
            ? formatNumber(row.totalPurchases ?? 0)
            : "-"}
        </div>
      )
    case "totalSpend":
      return (
        <div className="text-right">
          {(row.totalSpend ?? 0) > 0
            ? formatCurrency(row.totalSpend ?? 0, currency)
            : "-"}
        </div>
      )
    case "totalCpa": {
      const totalCpa = row.totalCpa ?? 0
      const highlight = getCostPerResultCellClassName(totalCpa, currency)
      return (
        <div className={cn("-m-2 p-2 text-right", highlight)}>
          {totalCpa > 0 ? formatCurrency(totalCpa, currency) : "-"}
        </div>
      )
    }
  }
}
