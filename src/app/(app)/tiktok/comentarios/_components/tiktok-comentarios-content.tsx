"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  RiChatCheckLine,
  RiExternalLinkLine,
  RiPlayLine,
} from "@remixicon/react"
import { runServerAction } from "@/lib/server-action"
import { getDashboardToday } from "@/lib/date"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type {
  TikTokCommentActivityFilter,
  TikTokCommentDateRange,
} from "@/lib/services/tiktok/comments/types"
import {
  enableTikTokSparkCommentsAction,
  getTikTokCommentAgentStatusAction,
  getTikTokCommentDashboardMetricsAction,
  listTikTokCommentActivityAction,
  listTikTokCommentAgentRunsAction,
  listTikTokLiveCommentsAction,
  retryTikTokCommentDecisionAction,
  runTikTokCommentAgentNowAction,
} from "../_actions/tiktok-comments-agent"
import { TikTokCommentsFeed, type TikTokFeedFilter } from "./tiktok-comments-feed"
import { TikTokCommentsHealth } from "./tiktok-comments-health"
import { limaDayKey } from "./tiktok-comments-format"

const RANGES: Array<{ id: TikTokCommentDateRange; label: string }> = [
  { id: "today", label: "Hoy" },
  { id: "7d", label: "7 días" },
]

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function TikTokComentariosContent() {
  const queryClient = useQueryClient()
  const [range, setRange] = useState<TikTokCommentDateRange>("today")
  const [filter, setFilter] = useState<TikTokFeedFilter>("all")

  const decisionsFilter: TikTokCommentActivityFilter =
    filter === "new" ? "all" : filter

  const statusQuery = useQuery({
    queryKey: ["tiktok-comment-agent-status"],
    queryFn: () => runServerAction(getTikTokCommentAgentStatusAction()),
  })
  const status = statusQuery.data
  const ready = Boolean(status?.aiConfigured && status?.tiktokConfigured)

  const metricsQuery = useQuery({
    queryKey: ["tiktok-comment-metrics", range],
    queryFn: () =>
      runServerAction(getTikTokCommentDashboardMetricsAction(range)),
  })

  const activityQuery = useQuery({
    queryKey: ["tiktok-comment-activity", range, decisionsFilter],
    queryFn: () =>
      runServerAction(
        listTikTokCommentActivityAction({ range, filter: decisionsFilter })
      ),
    enabled: filter !== "new",
  })

  const runsQuery = useQuery({
    queryKey: ["tiktok-comment-agent-runs"],
    queryFn: () => runServerAction(listTikTokCommentAgentRunsAction()),
    // Mientras haya una corrida en curso, refrescar para ver cuándo termina.
    refetchInterval: (query) =>
      query.state.data?.some((run) => run.status === "running")
        ? 10_000
        : false,
  })

  const liveQuery = useQuery({
    queryKey: ["tiktok-live-comments"],
    queryFn: () => runServerAction(listTikTokLiveCommentsAction()),
    enabled: ready,
    refetchInterval: 5 * 60_000,
    staleTime: 4 * 60_000,
    refetchOnWindowFocus: false,
  })

  const newComments = useMemo(() => {
    const pending = liveQuery.data?.comments.filter((c) => !c.processed)
    if (!pending) return undefined
    if (range === "7d") return pending
    const today = getDashboardToday()
    return pending.filter((c) => limaDayKey(c.createdTime) === today)
  }, [liveQuery.data, range])

  const invalidateDashboard = () =>
    Promise.all(
      [
        "tiktok-comment-metrics",
        "tiktok-comment-activity",
        "tiktok-comment-agent-runs",
        "tiktok-live-comments",
      ].map((key) => queryClient.invalidateQueries({ queryKey: [key] }))
    )

  const runMutation = useMutation({
    mutationFn: () => runServerAction(runTikTokCommentAgentNowAction()),
    onSettled: invalidateDashboard,
  })

  const retryMutation = useMutation({
    mutationFn: (decisionId: string) =>
      runServerAction(retryTikTokCommentDecisionAction(decisionId)),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tiktok-comment-metrics"] }),
        queryClient.invalidateQueries({
          queryKey: ["tiktok-comment-activity"],
        }),
      ]),
  })

  const enableCommentsMutation = useMutation({
    mutationFn: () => runServerAction(enableTikTokSparkCommentsAction()),
    onSuccess: invalidateDashboard,
  })

  const runInProgress =
    runMutation.isPending ||
    Boolean(runsQuery.data?.some((run) => run.status === "running"))

  const runResult = runMutation.data
  const enableResult = enableCommentsMutation.data

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-5 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-muted-foreground text-sm">
            <Link href="/tiktok" className="hover:text-foreground">
              TikTok
            </Link>
            <span className="mx-2">/</span>
            <span>Comentarios IA</span>
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            Comentarios IA
          </h1>
          <p className="text-muted-foreground text-sm">
            La IA modera los ads Spark de @Calzados_urbanos y @Calzados Elite:
            oculta spam, responde preguntas y deja pasar los positivos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-muted inline-flex rounded-lg p-1">
            {RANGES.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={range === option.id}
                onClick={() => setRange(option.id)}
                className={cn(
                  "focus-visible:ring-ring/50 rounded-md px-3 py-1 text-sm font-medium outline-none focus-visible:ring-3",
                  range === option.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/meta/comentarios/configuracion">
              Prompts y productos
              <RiExternalLinkLine className="size-3.5" />
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => enableCommentsMutation.mutate()}
            disabled={enableCommentsMutation.isPending || !ready}
          >
            <RiChatCheckLine className="size-4" />
            {enableCommentsMutation.isPending
              ? "Habilitando…"
              : "Habilitar comentarios Spark"}
          </Button>
          <Button
            size="sm"
            onClick={() => runMutation.mutate()}
            disabled={runInProgress || !ready}
          >
            <RiPlayLine className="size-4" />
            {runInProgress ? "Ejecutando…" : "Ejecutar ahora"}
          </Button>
        </div>
      </header>

      {status && status.missing.length > 0 ? (
        <p className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-2.5 text-sm">
          Falta configurar: {status.missing.join(", ")}.
        </p>
      ) : null}

      {runResult ? (
        <div
          className={cn(
            "rounded-lg border px-4 py-2.5 text-sm",
            runResult.status === "failed"
              ? "border-destructive/30 bg-destructive/5"
              : "border-emerald-500/30 bg-emerald-500/5"
          )}
        >
          <span className="font-medium">
            {runResult.status === "failed"
              ? "La corrida falló: "
              : "Corrida terminada: "}
          </span>
          {runResult.status === "failed"
            ? runResult.errorMessage
            : runResult.summary}
        </div>
      ) : null}
      {runMutation.isError ? (
        <p className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-2.5 text-sm">
          {errorMessage(runMutation.error, "Error al ejecutar el agente")}
        </p>
      ) : null}

      {enableResult ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-2.5 text-sm">
          Comentarios habilitados en {enableResult.updated} de{" "}
          {enableResult.adgroupsTargeted} conjuntos Spark.
          {enableResult.failed.length > 0 ? (
            <span className="text-destructive">
              {" "}
              Fallaron {enableResult.failed.length}:{" "}
              {enableResult.failed
                .slice(0, 2)
                .map((f) => f.error)
                .join(" · ")}
            </span>
          ) : null}
        </div>
      ) : null}
      {enableCommentsMutation.isError ? (
        <p className="text-destructive text-sm">
          {errorMessage(
            enableCommentsMutation.error,
            "Error al habilitar comentarios"
          )}
        </p>
      ) : null}
      {retryMutation.isError ? (
        <p className="text-destructive text-sm">
          {errorMessage(retryMutation.error, "No se pudo reintentar")}
        </p>
      ) : null}

      <TikTokCommentsHealth
        status={status}
        metrics={metricsQuery.data}
        runs={runsQuery.data}
      />

      <TikTokCommentsFeed
        filter={filter}
        onFilterChange={setFilter}
        metrics={metricsQuery.data}
        decisions={activityQuery.data}
        decisionsLoading={activityQuery.isLoading}
        newComments={newComments}
        newLoading={liveQuery.isLoading}
        liveError={
          liveQuery.error
            ? errorMessage(liveQuery.error, "Error al leer comentarios")
            : null
        }
        liveFetchErrors={liveQuery.data?.fetchErrors ?? []}
        onRetry={(id) => retryMutation.mutate(id)}
        retryingId={retryMutation.isPending ? retryMutation.variables : null}
      />
    </div>
  )
}
