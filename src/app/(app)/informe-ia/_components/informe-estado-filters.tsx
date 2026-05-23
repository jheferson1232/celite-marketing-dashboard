"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type {
  InformeEstadoFilter,
  InformeEstadoFilterKey,
} from "@/lib/services/meta/meta-informe-scoring"

export type InformeEstadoFilterLabelMode = "estado" | "total"

const ESTADO_LABELS: Record<
  InformeEstadoFilterLabelMode,
  Record<InformeEstadoFilterKey, string>
> = {
  estado: {
    EXCELENTE: "excelente",
    EN_CURSO: "en curso",
    CRITICO: "crítico",
  },
  total: {
    EXCELENTE: "t/exelente",
    EN_CURSO: "t/curso",
    CRITICO: "t/critico",
  },
}

const ESTADO_FILTERS: {
  key: InformeEstadoFilterKey
  idle: string
  active: string
}[] = [
  {
    key: "EXCELENTE",
    idle:
      "border-green-600 text-green-600 hover:bg-green-500/10 dark:border-green-500 dark:text-green-400",
    active:
      "border-green-600 bg-green-600 text-white hover:bg-green-600 dark:border-green-500 dark:bg-green-600",
  },
  {
    key: "EN_CURSO",
    idle:
      "border-orange-500 text-orange-600 hover:bg-orange-500/10 dark:border-orange-500 dark:text-orange-400",
    active:
      "border-orange-500 bg-orange-500 text-white hover:bg-orange-500 dark:border-orange-500 dark:bg-orange-500",
  },
  {
    key: "CRITICO",
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
  labelMode = "estado",
  showTodas = true,
}: {
  counts: InformeEstadoCounts
  selectedFilter: InformeEstadoFilter
  onFilterChange: (filter: InformeEstadoFilter) => void
  /** `total`: t/critico, t/exelente, t/curso (gasto total del informe). */
  labelMode?: InformeEstadoFilterLabelMode
  /** Fila t/: sin botón «todas». */
  showTodas?: boolean
}) {
  const labels = ESTADO_LABELS[labelMode]
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0)

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showTodas ? (
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
      ) : null}
      {ESTADO_FILTERS.map(({ key, idle, active }) => {
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
            {counts[key]} {labels[key]}
          </Badge>
        )
      })}
    </div>
  )
}

const ACTIVAR_IDLE =
  "border-yellow-500 text-yellow-700 hover:bg-yellow-500/15 dark:border-yellow-400 dark:text-yellow-300"
const ACTIVAR_ACTIVE =
  "border-yellow-500 bg-yellow-500 text-yellow-950 hover:bg-yellow-500 dark:border-yellow-400 dark:bg-yellow-400 dark:text-yellow-950"

export function InformeFilterBars({
  estadoCounts,
  periodCounts,
  activarCount,
  estadoFilter,
  periodFilter,
  activarFilter,
  onEstadoFilterChange,
  onPeriodFilterChange,
  onActivarFilterChange,
}: {
  estadoCounts: InformeEstadoCounts
  periodCounts: InformeEstadoCounts
  activarCount: number
  estadoFilter: InformeEstadoFilter
  periodFilter: InformeEstadoFilter
  activarFilter: boolean
  onEstadoFilterChange: (filter: InformeEstadoFilter) => void
  onPeriodFilterChange: (filter: InformeEstadoFilter) => void
  onActivarFilterChange: (active: boolean) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <InformeEstadoFilters
        counts={estadoCounts}
        selectedFilter={estadoFilter}
        onFilterChange={onEstadoFilterChange}
        labelMode="estado"
      />
      <div className="flex flex-wrap items-center gap-2">
        <InformeEstadoFilters
          counts={periodCounts}
          selectedFilter={periodFilter}
          onFilterChange={onPeriodFilterChange}
          labelMode="total"
          showTodas={false}
        />
        <Badge
          variant="outline"
          className={cn(
            "cursor-pointer px-3 text-sm font-semibold",
            activarFilter ? ACTIVAR_ACTIVE : ACTIVAR_IDLE
          )}
          title="Conjuntos OFF en Meta con compras y CPA total < 10.000 COP en el informe"
          onClick={() => onActivarFilterChange(!activarFilter)}
        >
          {activarCount} activar
        </Badge>
      </div>
    </div>
  )
}
