"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type {
  TikTokCommentAgentRunSummary,
  TikTokCommentAgentStatus,
  TikTokCommentDashboardMetrics,
} from "@/lib/services/tiktok/comments/types"
import { formatLimaDateTime, formatRelative } from "./tiktok-comments-format"

function Dot({ tone }: { tone: "ok" | "warn" | "bad" | "idle" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        tone === "ok" && "bg-emerald-500 ring-3 ring-emerald-500/15",
        tone === "warn" && "bg-amber-500 ring-3 ring-amber-500/15",
        tone === "bad" && "bg-red-500 ring-3 ring-red-500/15",
        tone === "idle" && "bg-muted-foreground/40"
      )}
    />
  )
}

function RunsCell({ runs }: { runs: TikTokCommentAgentRunSummary[] }) {
  const ordered = [...runs].reverse()
  const maxSeen = Math.max(1, ...ordered.map((run) => run.commentsSeen))
  const last = runs[0]

  const tone = !last
    ? "idle"
    : last.status === "failed"
      ? "bad"
      : last.status === "running"
        ? "warn"
        : "ok"

  const lastLabel = !last
    ? "Todavía no hay corridas"
    : last.status === "running"
      ? `En curso · empezó ${formatRelative(last.startedAt)}`
      : last.status === "failed"
        ? `Falló ${formatRelative(last.startedAt)}`
        : `OK ${formatRelative(last.startedAt)} · ${last.commentsSeen} comentario(s)`

  return (
    <div className="bg-card col-span-2 flex min-w-0 flex-col gap-1.5 p-3.5 sm:col-span-5 lg:col-span-2">
      <span className="text-muted-foreground text-xs">
        Corridas · solo manual (cron desactivado)
      </span>
      <div
        className="flex h-6 items-end gap-[3px]"
        aria-label="Últimas corridas, de la más vieja a la más nueva"
      >
        {ordered.length === 0 ? (
          <span className="bg-muted h-px w-full" />
        ) : (
          ordered.map((run) => (
            <span
              key={run.runId}
              title={`${formatLimaDateTime(run.startedAt)} · ${
                run.status === "failed"
                  ? `Falló: ${run.errorMessage ?? ""}`
                  : `${run.commentsSeen} comentarios · ${run.actionsCount} acciones`
              }`}
              className={cn(
                "max-w-4 min-w-1.5 flex-1 rounded-[2px]",
                run.status === "failed"
                  ? "bg-red-500"
                  : run.status === "running"
                    ? "bg-amber-500"
                    : "bg-emerald-500/85"
              )}
              style={{
                height: `${Math.max(15, (run.commentsSeen / maxSeen) * 100)}%`,
              }}
            />
          ))
        )}
      </div>
      <span className="flex items-center gap-2 text-xs">
        <Dot tone={tone} />
        <span className="text-muted-foreground truncate">{lastLabel}</span>
      </span>
      {last?.status === "failed" && last.errorMessage ? (
        <span className="text-destructive line-clamp-2 text-xs">
          {last.errorMessage}
        </span>
      ) : null}
    </div>
  )
}

function ConnectionsCell({
  status,
}: {
  status: TikTokCommentAgentStatus | undefined
}) {
  return (
    <div className="bg-card col-span-2 flex min-w-0 flex-col gap-1.5 p-3.5 sm:col-span-1">
      <span className="text-muted-foreground text-xs">Conexiones</span>
      {status ? (
        <>
          <span className="flex items-center gap-2 text-xs">
            <Dot tone={status.aiConfigured ? "ok" : "bad"} />
            <span className="truncate">
              {status.aiConfigured
                ? status.aiModelLabel
                : "Falta AI_GATEWAY_API_KEY"}
            </span>
          </span>
          <span className="flex items-center gap-2 text-xs">
            <Dot tone={status.tiktokConfigured ? "ok" : "bad"} />
            <span className="truncate">
              {status.tiktokConfigured
                ? `TikTok · ${status.accountsCount} cuenta${status.accountsCount === 1 ? "" : "s"}`
                : "Conectá TikTok Ads"}
            </span>
          </span>
        </>
      ) : (
        <Skeleton className="h-9 w-full" />
      )}
    </div>
  )
}

function MetricCell({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: number | undefined
  hint: string
  tone?: "ok" | "bad" | "warn"
}) {
  return (
    <div className="bg-card flex min-w-0 flex-col gap-1 p-3.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      {value == null ? (
        <Skeleton className="h-7 w-12" />
      ) : (
        <span
          className={cn(
            "text-2xl leading-7 font-semibold tabular-nums",
            tone === "ok" && "text-emerald-600 dark:text-emerald-400",
            tone === "bad" && "text-red-600 dark:text-red-400",
            tone === "warn" &&
              value > 0 &&
              "text-amber-600 dark:text-amber-400"
          )}
        >
          {value}
        </span>
      )}
      <span className="text-muted-foreground truncate text-xs">{hint}</span>
    </div>
  )
}

export function TikTokCommentsHealth({
  status,
  metrics,
  runs,
}: {
  status: TikTokCommentAgentStatus | undefined
  metrics: TikTokCommentDashboardMetrics | undefined
  runs: TikTokCommentAgentRunSummary[] | undefined
}) {
  return (
    <div className="bg-border grid grid-cols-2 gap-px overflow-hidden rounded-xl border sm:grid-cols-5 lg:grid-cols-7">
      {runs ? (
        <RunsCell runs={runs} />
      ) : (
        <div className="bg-card col-span-2 p-3.5 sm:col-span-5 lg:col-span-2">
          <Skeleton className="h-16 w-full" />
        </div>
      )}
      <ConnectionsCell status={status} />
      <MetricCell
        label="Procesados"
        value={metrics?.processed}
        hint={metrics ? `${metrics.monitoredAds} ads Spark` : "…"}
      />
      <MetricCell
        label="Respondidos"
        value={metrics?.replied}
        hint="preguntas"
        tone="ok"
      />
      <MetricCell
        label="Ocultos"
        value={metrics?.hidden}
        hint="spam y troll"
        tone="bad"
      />
      <MetricCell
        label="Errores"
        value={metrics?.errors}
        hint="acciones fallidas"
        tone="warn"
      />
    </div>
  )
}
