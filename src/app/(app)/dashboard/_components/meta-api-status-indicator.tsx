"use client"

import { cn } from "@/lib/utils"
import type { MetaApiStatusResult } from "../_lib/meta-api-status"

interface MetaApiStatusIndicatorProps {
  status: MetaApiStatusResult
  className?: string
}

export function MetaApiStatusIndicator({
  status,
  className,
}: MetaApiStatusIndicatorProps) {
  const { status: state, label, description } = status

  const dotClass = cn(
    "relative inline-flex size-2.5 shrink-0 rounded-full",
    state === "loading" && "bg-green-500",
    state === "ok" && "bg-green-500",
    state === "rate_limit" && "bg-red-500",
    state === "error" && "bg-amber-500",
    state === "idle" && "bg-muted-foreground/40"
  )

  const pillClass = cn(
    "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-medium",
    state === "loading" &&
      "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400",
    state === "ok" &&
      "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400",
    state === "rate_limit" &&
      "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400",
    state === "error" &&
      "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-400",
    state === "idle" && "border-border bg-muted/30 text-muted-foreground"
  )

  return (
    <div
      className={cn(pillClass, className)}
      title={description}
      role="status"
      aria-live="polite"
      aria-label={`${label}. ${description}`}
    >
      <span className="relative flex size-2.5">
        <span className={dotClass} />
        {(state === "loading" || state === "rate_limit") && (
          <span
            className={cn(
              "absolute inline-flex size-full animate-ping rounded-full opacity-75",
              state === "loading" && "bg-green-500",
              state === "rate_limit" && "bg-red-500"
            )}
          />
        )}
      </span>
      <span>{label}</span>
    </div>
  )
}
