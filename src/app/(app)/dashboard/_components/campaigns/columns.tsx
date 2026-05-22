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
import { MetaCampaignLandingUrlsButton } from "./meta-campaign-landing-urls-button"
import { TikTokCampaignLandingUrlsButton } from "@/app/(app)/tiktok/_components/tiktok-campaign-landing-urls-button"

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
  enableMetaExtendedMetrics?: boolean
  metaLandingUrlsLoading?: boolean
}

export function getCampaignColumns({
  expandedCampaignIds,
  onToggleAdSets,
  onOpenDetails,
  currency = META_DASHBOARD_CURRENCY,
  enableTikTokManage = false,
  enableMetaExtendedMetrics = false,
  metaLandingUrlsLoading = false,
}: GetCampaignColumnsOptions): ColumnDef<CampaignRow>[] {
  const manageColumns = enableTikTokManage ? getTikTokCampaignManageColumns() : []
  const showLifetimeMetrics = enableTikTokManage || enableMetaExtendedMetrics
  const showLandingUrls = enableTikTokManage || enableMetaExtendedMetrics
  const usePurchaseLabels = enableTikTokManage || enableMetaExtendedMetrics
  const showAddToCart =
    !enableTikTokManage && !enableMetaExtendedMetrics && currency === META_DASHBOARD_CURRENCY

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
          <div
            className={cn(
              "flex min-w-0 items-center gap-2 pl-3 font-medium",
              enableTikTokManage &&
                "max-w-[10rem] sm:max-w-[14rem] md:max-w-[18rem] lg:max-w-none"
            )}
          >
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
            <span className="truncate" title={row.original.name}>
              {row.original.name}
            </span>
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
      meta: columnMeta(usePurchaseLabels ? "Compras" : "Resultados"),
      header: (context) => (
        <SortableHeader
          context={context}
          label={usePurchaseLabels ? "Compras" : "Resultados"}
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
      meta: columnMeta(usePurchaseLabels ? "CPA" : "Costo/Res"),
      header: (context) => (
        <SortableHeader
          context={context}
          label={usePurchaseLabels ? "CPA" : "Costo/Res"}
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
    ...(showLifetimeMetrics
      ? [
          {
            id: "purchases7d",
            accessorKey: "purchases7d",
            meta: columnMeta("Ventas 7d"),
            header: (context) => (
              <span title="Compras en los últimos 7 días">
                <SortableHeader context={context} label="Ventas 7d" />
              </span>
            ),
            cell: ({ row }) => (
              <div className="text-right">
                {(row.original.purchases7d ?? 0) > 0
                  ? formatNumber(row.original.purchases7d ?? 0)
                  : "-"}
              </div>
            ),
          } satisfies ColumnDef<CampaignRow>,
          {
            id: "cpa7d",
            accessorKey: "cpa7d",
            meta: columnMeta("CPA 7d"),
            header: (context) => (
              <span title="CPA en los últimos 7 días (sin columna de gasto)">
                <SortableHeader context={context} label="CPA 7d" />
              </span>
            ),
            cell: ({ row }) => {
              const cpa7d = row.original.cpa7d ?? 0
              const highlight = getCostPerResultCellClassName(cpa7d, currency)
              return (
                <div className={cn("-m-2 p-2 text-right", highlight)}>
                  {cpa7d > 0 ? formatCurrency(cpa7d, currency) : "-"}
                </div>
              )
            },
          } satisfies ColumnDef<CampaignRow>,
          {
            id: "totalPurchases",
            accessorKey: "totalPurchases",
            meta: {
              ...columnMeta("Total ventas"),
              description: "Compras acumuladas (~365 días)",
            },
            header: (context) => (
              <span title="Compras acumuladas en los últimos ~365 días">
                <SortableHeader context={context} label="Total ventas" />
              </span>
            ),
            cell: ({ row }) => (
              <div className="text-right font-medium">
                {(row.original.totalPurchases ?? 0) > 0
                  ? formatNumber(row.original.totalPurchases ?? 0)
                  : "-"}
              </div>
            ),
          } satisfies ColumnDef<CampaignRow>,
          {
            id: "totalSpend",
            accessorKey: "totalSpend",
            meta: {
              ...columnMeta("Gasto total"),
              description: "Gasto acumulado (~365 días)",
            },
            header: (context) => (
              <span title="Gasto acumulado en los últimos ~365 días">
                <SortableHeader context={context} label="Gasto total" />
              </span>
            ),
            cell: ({ row }) => (
              <div className="text-right">
                {(row.original.totalSpend ?? 0) > 0
                  ? formatCurrency(row.original.totalSpend ?? 0, currency)
                  : "-"}
              </div>
            ),
          } satisfies ColumnDef<CampaignRow>,
          {
            id: "totalCpa",
            accessorKey: "totalCpa",
            meta: {
              ...columnMeta("CPA total"),
              description: "CPA sobre totales (~365 días)",
            },
            header: (context) => (
              <span title="Gasto total ÷ total ventas (~365 días)">
                <SortableHeader context={context} label="CPA total" />
              </span>
            ),
            cell: ({ row }) => {
              const totalCpa = row.original.totalCpa ?? 0
              const highlight = getCostPerResultCellClassName(
                totalCpa,
                currency
              )
              return (
                <div className={cn("-m-2 p-2 text-right", highlight)}>
                  {totalCpa > 0 ? formatCurrency(totalCpa, currency) : "-"}
                </div>
              )
            },
          } satisfies ColumnDef<CampaignRow>,
        ]
      : []),
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
            {showLandingUrls && enableMetaExtendedMetrics && row.original.id ? (
              <MetaCampaignLandingUrlsButton
                urls={row.original.landingUrls ?? []}
                campaignId={row.original.id}
                campaignName={row.original.name}
                globalUrlsLoading={metaLandingUrlsLoading}
              />
            ) : null}
            {showLandingUrls && enableTikTokManage ? (
              <TikTokCampaignLandingUrlsButton
                urls={row.original.landingUrls ?? []}
                campaignName={row.original.name}
              />
            ) : null}
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
  if (enableTikTokManage || enableMetaExtendedMetrics) {
    return columns.filter((column) => column.id !== "roas")
  }
  return columns
}
