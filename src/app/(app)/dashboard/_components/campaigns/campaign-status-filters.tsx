"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type {
  CampaignPerformanceFilter,
  CampaignPerformanceStatus,
} from "./types"
interface StatusFilterConfig {
  status: CampaignPerformanceStatus
  label: string
  colorClassName: string
}

const STATUS_FILTERS: StatusFilterConfig[] = [
  {
    status: "EXCELENTE",
    label: "excelente",
    colorClassName: "border-green-600 text-green-600 hover:bg-green-50",
  },
  {
    status: "EN_CURSO",
    label: "en curso",
    colorClassName: "border-orange-500 text-orange-600 hover:bg-orange-50",
  },
  {
    status: "CRITICO",
    label: "crítico",
    colorClassName: "border-red-500 text-red-600 hover:bg-red-50",
  },
  {
    status: "APAGADO",
    label: "apagado",
    colorClassName: "border-gray-400 text-gray-500 hover:bg-gray-50",
  },
]

const ACTIVE_COLOR_CLASS: Record<CampaignPerformanceStatus, string> = {
  EXCELENTE: "border-green-600 bg-green-600 text-white hover:bg-green-600",
  EN_CURSO: "border-orange-500 bg-orange-500 text-white hover:bg-orange-500",
  CRITICO: "border-red-500 bg-red-500 text-white hover:bg-red-500",
  APAGADO: "border-gray-500 bg-gray-500 text-white hover:bg-gray-500",
}

interface CampaignStatusFiltersProps {
  counts: Record<CampaignPerformanceStatus, number>
  selectedFilter: CampaignPerformanceFilter
  onFilterChange: (filter: CampaignPerformanceFilter) => void
  /** Muestra chip "Todas" (útil en TikTok para ver todas las campañas de la cuenta). */
  showAllFilter?: boolean
  /** TikTok: campañas con interruptor Act. en ON (nivel campaña). */
  activeCampaignCount?: number
  showActiveFilter?: boolean
  /** Total real de filas (no suma de chips, que en TikTok se solapan). */
  totalCampaignCount?: number
  /** TikTok: chip "apagado" = interruptor OFF, no "sin gasto en el periodo". */
  apagadoMeansSwitchOff?: boolean
}

export function CampaignStatusFilters({
  counts,
  selectedFilter,
  onFilterChange,
  showAllFilter = false,
  activeCampaignCount = 0,
  showActiveFilter = false,
  totalCampaignCount,
  apagadoMeansSwitchOff = false,
}: CampaignStatusFiltersProps) {
  const totalCount =
    totalCampaignCount ?? Object.values(counts).reduce((sum, n) => sum + n, 0)
  const isAllActive = selectedFilter === "ALL"
  const isActivosActive = selectedFilter === "ACTIVOS"
  const offCount = apagadoMeansSwitchOff
    ? counts.APAGADO
    : Math.max(0, totalCount - activeCampaignCount)

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
      {showAllFilter ? (
        <Badge
          variant="outline"
          className={cn(
            "cursor-pointer px-3 text-sm font-semibold",
            isAllActive
              ? "border-primary bg-primary text-primary-foreground hover:bg-primary"
              : "border-muted-foreground/40 text-muted-foreground hover:bg-muted/50"
          )}
          onClick={() => onFilterChange("ALL")}
        >
          {totalCount} todas
        </Badge>
      ) : null}
      {showActiveFilter ? (
        <Badge
          variant="outline"
          className={cn(
            "cursor-pointer px-3 text-sm font-semibold",
            isActivosActive
              ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-600"
              : "border-blue-500/70 text-blue-600 hover:bg-blue-500/10 dark:text-blue-400"
          )}
          onClick={() => onFilterChange(isActivosActive ? "ALL" : "ACTIVOS")}
        >
          {activeCampaignCount} activos
        </Badge>
      ) : null}
      {STATUS_FILTERS.map(({ status, label, colorClassName }) => {
        const count = counts[status]
        const isActive = selectedFilter === status
        const displayLabel =
          status === "APAGADO" && apagadoMeansSwitchOff ? "apagadas" : label

        return (
          <Badge
            key={status}
            variant="outline"
            title={
              status === "APAGADO" && apagadoMeansSwitchOff
                ? "Campañas con interruptor Act. apagado"
                : status === "APAGADO"
                  ? "Sin gasto en el periodo (siguen en la tabla con «todas»)"
                  : status === "EN_CURSO"
                    ? "Con gasto en el periodo y CPA en rango normal"
                    : undefined
            }
            className={cn(
              "cursor-pointer px-3 text-sm font-semibold",
              isActive ? ACTIVE_COLOR_CLASS[status] : colorClassName
            )}
            onClick={() => onFilterChange(isActive ? "ALL" : status)}
          >
            {count} {displayLabel}
          </Badge>
        )
      })}
      </div>
      {showActiveFilter && (isActivosActive || selectedFilter === "APAGADO") ? (
        <p className="text-sm text-muted-foreground">
          {isActivosActive ? (
            <>
              Hoy hay <strong>{activeCampaignCount}</strong> campaña
              {activeCampaignCount === 1 ? "" : "s"} con interruptor encendido y{" "}
              <strong>{offCount}</strong> apagada{offCount === 1 ? "" : "s"}.
              {counts.EN_CURSO > 0 ? (
                <>
                  {" "}
                  Con gasto en el periodo: <strong>{counts.EN_CURSO}</strong> en
                  curso.
                </>
              ) : null}
            </>
          ) : (
            <>
              Campañas con interruptor <strong>Act.</strong> apagado:{" "}
              <strong>{offCount}</strong>.
            </>
          )}
        </p>
      ) : null}
    </div>
  )
}
