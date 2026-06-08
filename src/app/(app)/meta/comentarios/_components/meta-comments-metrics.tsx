"use client"

import type { ReactNode } from "react"
import {
  RiChat3Line,
  RiDeleteBinLine,
  RiErrorWarningLine,
  RiReplyLine,
} from "@remixicon/react"
import { Skeleton } from "@/components/ui/skeleton"
import type { MetaCommentDashboardMetrics } from "@/lib/services/meta/comments/types"

type MetricCardProps = {
  label: string
  value: number
  hint: string
  icon: ReactNode
  accent: "blue" | "red" | "green" | "amber"
}

const accentStyles = {
  blue: {
    icon: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    value: "text-blue-600 dark:text-blue-400",
  },
  red: {
    icon: "bg-red-500/10 text-red-600 dark:text-red-400",
    value: "text-red-600 dark:text-red-400",
  },
  green: {
    icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    value: "text-emerald-600 dark:text-emerald-400",
  },
  amber: {
    icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    value: "text-amber-600 dark:text-amber-400",
  },
}

function MetricCard({ label, value, hint, icon, accent }: MetricCardProps) {
  const styles = accentStyles[accent]
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex size-11 items-center justify-center rounded-xl ${styles.icon}`}
        >
          {icon}
        </div>
      </div>
      <p className="text-muted-foreground mt-4 text-sm">{label}</p>
      <p className={`mt-1 text-4xl font-bold tracking-tight ${styles.value}`}>
        {value}
      </p>
      <p className="text-muted-foreground mt-2 text-xs">{hint}</p>
    </div>
  )
}

export function MetaCommentsMetrics({
  metrics,
  loading,
}: {
  metrics: MetaCommentDashboardMetrics | undefined
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-2xl" />
        ))}
      </div>
    )
  }

  const rangeLabel = metrics?.range === "7d" ? "últimos 7 días" : "hoy"

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Actividad total"
        value={metrics?.totalActivity ?? 0}
        hint={`Comentarios procesados (${rangeLabel})`}
        icon={<RiChat3Line className="size-5" />}
        accent="blue"
      />
      <MetricCard
        label="Comentarios ocultados"
        value={metrics?.deletedComments ?? 0}
        hint="Spam, trolls y negativos"
        icon={<RiDeleteBinLine className="size-5" />}
        accent="red"
      />
      <MetricCard
        label="Respuestas enviadas"
        value={metrics?.repliedComments ?? 0}
        hint="Preguntas respondidas por IA"
        icon={<RiReplyLine className="size-5" />}
        accent="green"
      />
      <MetricCard
        label="Errores"
        value={metrics?.errors ?? 0}
        hint="Acciones fallidas o no aplicadas"
        icon={<RiErrorWarningLine className="size-5" />}
        accent="amber"
      />
    </div>
  )
}
