"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { RiInformationLine, RiStackLine } from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { CampaignRow } from "@/lib/services/meta/types"
import { SortableHeader } from "./sortable-header"
import type { CampaignColumnMeta } from "./types"
import {
  formatCurrency,
  META_DASHBOARD_CURRENCY,
  type CurrencyCode,
} from "@/lib/format"
import {
  formatNumber,
  formatPercent,
  getCostPerResultCellClassName,
} from "./utils"
import { getTikTokCampaignManageColumns } from "@/app/(app)/tiktok/_components/tiktok-campaign-manage-columns"
import { TikTokCampaignBudgetCell } from "@/app/(app)/tiktok/_components/tiktok-campaign-budget-cell"

function columnMeta(
  label: string,
  align: CampaignColumnMeta["align"] = "right"
): CampaignColumnMeta {
  return { label, align }
}

interface GetCampaignColumnsOptions {
  expandedCampaignIds: Set<string>
  onToggleAdSets: (campaignId: string) => void
  onOpenDetails: (campaign: CampaignRow) => void
  currency?: CurrencyCode
  enableTikTokManage?: boolean
}

export function getCampaignColumns({
  expandedCampaignIds,
  onToggleAdSets,
  onOpenDetails,
  currency = META_DASHBOARD_CURRENCY,
  enableTikTokManage = false,
}: GetCampaignColumnsOptions): ColumnDef<CampaignRow>[] {
  const manageColumns = enableTikTokManage ? getTikTokCampaignManageColumns() : []
  const showAddToCart = !enableTikTokManage && currency === META_DASHBOARD_CURRENCY

  const dataColumns: ColumnDef<CampaignRow>[] = [
    {
      id: "name",
      accessorKey: "name",
      meta: columnMeta("Campaña", "left"),
      header: (context) => (
        <SortableHeader
          context={context}
          label="Campaña"
          align="left"
          className="pl-3"
        />
      ),
      cell: ({ row }) => {
        const isActive = row.original.status === "ACTIVE"
        return (
          <div className="flex items-center gap-2 pl-3 font-medium">
            <div
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                isActive ? "bg-blue-500" : "bg-gray-400"
              )}
              title={
                !enableTikTokManage
                  ? isActive
                    ? "Campaña activa"
                    : "Campaña desactivada"
                  : undefined
              }
            />
            <span>{row.original.name}</span>
          </div>
        )
      },
    },
    {
      id: "spend",
      accessorKey: "spend",
      meta: columnMeta("Gasto"),
      header: (context) => <SortableHeader context={context} label="Gasto" />,
      cell: ({ row }) => (
        <div className="text-right">
          {formatCurrency(row.original.spend, currency)}
        </div>
      ),
    },
    {
      id: "impressions",
      accessorKey: "impressions",
      meta: columnMeta("Impresiones"),
      header: (context) => (
        <SortableHeader context={context} label="Impresiones" />
      ),
      cell: ({ row }) => (
        <div className="text-right">
          {formatNumber(row.original.impressions)}
        </div>
      ),
    },
    ...(enableTikTokManage
      ? [
          {
            id: "budget",
            enableSorting: false,
            enableHiding: false,
            meta: columnMeta("Presupuesto"),
            header: (context) => (
              <SortableHeader context={context} label="Presupuesto" />
            ),
            cell: ({ row }) => {
              if (!row.original.id) return null
              return <TikTokCampaignBudgetCell campaign={row.original} />
            },
          } satisfies ColumnDef<CampaignRow>,
        ]
      : []),
    {
      id: "adSetsCount",
      accessorKey: "adSetsCount",
      meta: columnMeta("Conjuntos"),
      header: (context) => (
        <SortableHeader context={context} label="Conjuntos" />
      ),
      cell: ({ row }) => (
        <div className="text-right">{row.original.adSetsCount}</div>
      ),
    },
    {
      id: "activeAdsCount",
      accessorKey: "activeAdsCount",
      meta: columnMeta("Conj. activos"),
      header: (context) => (
        <SortableHeader context={context} label="Conj. activos" />
      ),
      cell: ({ row }) => (
        <div className="text-right">
          <span
            className={cn(
              row.original.activeAdsCount > 0 && "font-medium text-orange-500"
            )}
          >
            {row.original.activeAdsCount}
          </span>
        </div>
      ),
    },
    {
      id: "ctr",
      accessorKey: "ctr",
      meta: columnMeta("CTR"),
      header: (context) => <SortableHeader context={context} label="CTR" />,
      cell: ({ row }) => (
        <div className="text-right text-red-500">
          {formatPercent(row.original.ctr)}
        </div>
      ),
    },
    {
      id: "cpc",
      accessorKey: "cpc",
      meta: columnMeta("CPC"),
      header: (context) => <SortableHeader context={context} label="CPC" />,
      cell: ({ row }) => (
        <div className="text-right">
          {formatCurrency(row.original.cpc, currency)}
        </div>
      ),
    },
    {
      id: "results",
      accessorKey: "results",
      meta: columnMeta(enableTikTokManage ? "Compras" : "Resultados"),
      header: (context) => (
        <SortableHeader
          context={context}
          label={enableTikTokManage ? "Compras" : "Resultados"}
        />
      ),
      cell: ({ row }) => (
        <div className="text-right">
          {row.original.results > 0 ? formatNumber(row.original.results) : "-"}
        </div>
      ),
    },
    {
      id: "costPerResult",
      accessorKey: "costPerResult",
      meta: columnMeta(enableTikTokManage ? "CPA" : "Costo/Res"),
      header: (context) => (
        <SortableHeader
          context={context}
          label={enableTikTokManage ? "CPA" : "Costo/Res"}
        />
      ),
      cell: ({ row }) => {
        const { costPerResult } = row.original
        const highlight = getCostPerResultCellClassName(
          costPerResult,
          currency
        )

        return (
          <div className={cn("-m-2 p-2 text-right", highlight)}>
            {costPerResult > 0
              ? formatCurrency(costPerResult, currency)
              : "-"}
          </div>
        )
      },
    },
    {
      id: "roas",
      accessorFn: (row) => (row.addToCart ?? 0),
      meta: columnMeta(showAddToCart ? "Agreg. carrito" : "ROAS"),
      header: (context) => (
        <SortableHeader
          context={context}
          label={showAddToCart ? "Agreg. carrito" : "ROAS"}
        />
      ),
      cell: ({ row }) => (
        <div className="text-right">
          {showAddToCart ? (
            (row.original.addToCart ?? 0) > 0 ? (
              formatNumber(row.original.addToCart ?? 0)
            ) : (
              "-"
            )
          ) : row.original.roas > 0 ? (
            `${row.original.roas.toFixed(2)}x`
          ) : (
            "-"
          )}
        </div>
      ),
    },
    {
      id: "actions",
      enableSorting: false,
      enableHiding: false,
      meta: columnMeta("Acciones"),
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) => {
        const campaignId = row.original.id
        const isExpanded = expandedCampaignIds.has(campaignId)
        const hasValidId = Boolean(campaignId)

        return (
          <div className="flex items-center justify-end gap-1 pr-3">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => onToggleAdSets(campaignId)}
              disabled={!hasValidId}
              aria-expanded={isExpanded}
              aria-label={
                isExpanded
                  ? "Ocultar conjuntos de la campaña"
                  : "Ver conjuntos de la campaña"
              }
              title={
                hasValidId
                  ? isExpanded
                    ? "Ocultar conjuntos"
                    : "Ver conjuntos"
                  : "Campaña sin identificador"
              }
            >
              <RiStackLine data-icon="inline-start" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => onOpenDetails(row.original)}
              aria-label="Ver detalles de la campaña"
              title="Ver detalles"
            >
              <RiInformationLine data-icon="inline-start" />
            </Button>
          </div>
        )
      },
    },
  ]

  const columns = [...manageColumns, ...dataColumns]
  if (enableTikTokManage) {
    return columns.filter((column) => column.id !== "roas")
  }
  return columns
}
