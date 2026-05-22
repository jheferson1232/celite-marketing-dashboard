"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type {
  InformeEstadoFilter,
  InformeEstadoFilterKey,
} from "@/lib/services/meta/meta-informe-scoring"

const ESTADO_FILTERS: {
  key: InformeEstadoFilterKey
  label: string
  idle: string
  active: string
}[] = [
  {
    key: "EXCELENTE",
    label: "excelente",
    idle:
      "border-green-600 text-green-600 hover:bg-green-500/10 dark:border-green-500 dark:text-green-400",
    active:
      "border-green-600 bg-green-600 text-white hover:bg-green-600 dark:border-green-500 dark:bg-green-600",
  },
  {
    key: "EN_CURSO",
    label: "en curso",
    idle:
      "border-orange-500 text-orange-600 hover:bg-orange-500/10 dark:border-orange-500 dark:text-orange-400",
    active:
      "border-orange-500 bg-orange-500 text-white hover:bg-orange-500 dark:border-orange-500 dark:bg-orange-500",
  },
  {
    key: "CRITICO",
    label: "crítico",
    idle:
      "border-red-500 text-red-600 hover:bg-red-500/10 dark:border-red-500 dark:text-red-400",
    active:
      "border-red-500 bg-red-500 text-white hover:bg-red-500 dark:border-red-500 dark:bg-red-500",
  },
]

type InformeEstadoCounts = Record<InformeEstadoFilterKey, number>

export function InformeEstadoFilters({
  counts,
  selectedFilter,
  onFilterChange,
}: {
  counts: InformeEstadoCounts
  selectedFilter: InformeEstadoFilter
  onFilterChange: (filter: InformeEstadoFilter) => void
}) {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge
        variant="outline"
        className={cn(
          "cursor-pointer px-3 text-sm font-semibold",
          selectedFilter === "ALL"
            ? "border-primary bg-primary text-primary-foreground hover:bg-primary"
            : "border-muted-foreground/40 text-muted-foreground hover:bg-muted/50"
        )}
        onClick={() => onFilterChange("ALL")}
      >
        {total} todas
      </Badge>
      {ESTADO_FILTERS.map(({ key, label, idle, active }) => {
        const isActive = selectedFilter === key
        return (
          <Badge
            key={key}
            variant="outline"
            className={cn(
              "cursor-pointer px-3 text-sm font-semibold",
              isActive ? active : idle
            )}
            onClick={() => onFilterChange(isActive ? "ALL" : key)}
          >
            {counts[key]} {label}
          </Badge>
        )
      })}
    </div>
  )
}
