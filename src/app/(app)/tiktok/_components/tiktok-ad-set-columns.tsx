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
import {
  formatNumber,
  getCostPerResultCellClassName,
  getTikTokAdSetEstadoDisplay,
} from "@/app/(app)/dashboard/_components/campaigns/utils"

export const TIKTOK_AD_SET_METRIC_COLUMN_IDS = [
  "purchases7d",
  "cpa7d",
  "totalPurchases",
  "totalCpa",
] as const

export type TikTokAdSetMetricColumnId =
  (typeof TIKTOK_AD_SET_METRIC_COLUMN_IDS)[number]

export const TIKTOK_AD_SET_ESTADO_COLUMN_ID = "estado" as const

export type TikTokAdSetEstadoColumnId = typeof TIKTOK_AD_SET_ESTADO_COLUMN_ID

export type TikTokAdSetDisplayColumnId =
  | AdSetSubtableColumnId
  | TikTokAdSetManageColumnId
  | TikTokAdSetMetricColumnId
  | TikTokAdSetEstadoColumnId

const TIKTOK_AD_SET_METRIC_COLUMN_META: Record<
  TikTokAdSetMetricColumnId,
  CampaignColumnMeta
> = {
  purchases7d: { label: "Compras 7d", align: "right" },
  cpa7d: { label: "CPA 7d", align: "right" },
  totalPurchases: { label: "Total compras", align: "right" },
  totalCpa: { label: "CPA total", align: "right" },
}

const TIKTOK_METRIC_ID_SET = new Set<string>(TIKTOK_AD_SET_METRIC_COLUMN_IDS)

export function isTikTokAdSetMetricColumnId(
  columnId: string
): columnId is TikTokAdSetMetricColumnId {
  return TIKTOK_AD_SET_METRIC_COLUMN_IDS.includes(
    columnId as TikTokAdSetMetricColumnId
  )
}

export function isTikTokAdSetEstadoColumnId(
  columnId: string
): columnId is TikTokAdSetEstadoColumnId {
  return columnId === TIKTOK_AD_SET_ESTADO_COLUMN_ID
}

/** Sin Agreg. carrito; presupuesto tras Nombre; duplicar tras Presupuesto; métricas 7d tras CPA. */
export function getTikTokAdSetDisplayColumns(
  visibleSubtableColumns: AdSetSubtableColumnId[]
): TikTokAdSetDisplayColumnId[] {
  const withoutRoas = visibleSubtableColumns.filter((id) => id !== "roas")
  /** Evita duplicar 7d/totales: salen del listado base y se reinyectan una sola vez tras CPA. */
  const metricsToShow = TIKTOK_AD_SET_METRIC_COLUMN_IDS.filter((id) =>
    withoutRoas.includes(id)
  )
  const coreColumns = withoutRoas.filter((id) => !TIKTOK_METRIC_ID_SET.has(id))
  const base = getAdSetSubtableColumnsWithTikTokManage(coreColumns, true)
  const out: TikTokAdSetDisplayColumnId[] = []

  for (const columnId of base) {
    out.push(columnId)
    if (columnId === "active") {
      out.push(TIKTOK_AD_SET_ESTADO_COLUMN_ID)
    }
    if (columnId === "budget") {
      out.push("duplicate")
    }
    if (columnId === "costPerResult") {
      out.push(...metricsToShow)
    }
  }

  if (!out.includes("duplicate")) {
    out.push("duplicate")
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

  if (isTikTokAdSetEstadoColumnId(columnId)) {
    return { label: "Estado" }
  }

  if (columnId === "results") {
    return { label: "Compras", align: "right" }
  }
  if (columnId === "costPerResult") {
    return { label: "CPA", align: "right" }
  }

  return getAdSetSubtableColumnMeta(columnId, currency)
}

export function renderTikTokAdSetEstadoCell(
  row: CampaignAdSetRow,
  currency: CurrencyCode = TIKTOK_DASHBOARD_CURRENCY
) {
  const estado = getTikTokAdSetEstadoDisplay(row, currency)
  if (!estado) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <span className={cn("text-xs", estado.className)}>{estado.label}</span>
  )
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
