import type { VisibilityState } from "@tanstack/react-table"
import type { CampaignAdSetRow } from "@/lib/services/meta/types"
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
  currency: CurrencyCode = META_DASHBOARD_CURRENCY
) {
  if (isTikTokAdSetManageColumnId(columnId)) {
    return TIKTOK_AD_SET_MANAGE_COLUMN_META[columnId]
  }
  if (columnId === "roas" && currency === TIKTOK_DASHBOARD_CURRENCY) {
    return { label: "Agreg. carrito", align: "right" as const }
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
  currency: CurrencyCode = META_DASHBOARD_CURRENCY
) {
  switch (columnId) {
    case "name":
      return (
        <div className="flex items-center gap-2 pl-2 font-medium">
          <div
            className={cn(
              "h-2 w-2 rounded-full",
              row.status === "ACTIVE" ? "bg-blue-500" : "bg-gray-400"
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
      if (currency === TIKTOK_DASHBOARD_CURRENCY) {
        return (
          <div className="text-right">
            {(row.addToCart ?? 0) > 0 ? formatNumber(row.addToCart ?? 0) : "-"}
          </div>
        )
      }
      return (
        <div className="text-right">
          {row.roas > 0 ? `${row.roas.toFixed(2)}x` : "-"}
        </div>
      )
  }
}
