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
}

export function CampaignStatusFilters({
  counts,
  selectedFilter,
  onFilterChange,
  showAllFilter = false,
}: CampaignStatusFiltersProps) {
  const totalCount = Object.values(counts).reduce((sum, n) => sum + n, 0)
  const isAllActive = selectedFilter === "ALL"

  return (
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
      {STATUS_FILTERS.map(({ status, label, colorClassName }) => {
        const count = counts[status]
        const isActive = selectedFilter === status

        return (
          <Badge
            key={status}
            variant="outline"
            className={cn(
              "cursor-pointer px-3 text-sm font-semibold",
              isActive ? ACTIVE_COLOR_CLASS[status] : colorClassName
            )}
            onClick={() => onFilterChange(isActive ? "ALL" : status)}
          >
            {count} {label}
          </Badge>
        )
      })}
    </div>
  )
}
