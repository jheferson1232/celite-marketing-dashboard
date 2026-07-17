"use client"

import { useState } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  RiCalendarLine,
  RiChat3Line,
  RiPlayLine,
  RiSettings3Line,
  RiShoppingBag2Line,
  RiChatCheckLine,
} from "@remixicon/react"
import { runServerAction } from "@/lib/server-action"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { TIKTOK_COMMENT_CRON_EXPRESSION } from "@/lib/services/tiktok/comments/constants"
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
  runTikTokCommentAgentNowAction,
} from "../_actions/tiktok-comments-agent"
import { TikTokCommentsActivity } from "./tiktok-comments-activity"
import { TikTokCommentsMetrics } from "./tiktok-comments-metrics"
import { TikTokCommentsRuns } from "./tiktok-comments-runs"
import { TikTokCommentsStatus } from "./tiktok-comments-status"

export function TikTokComentariosContent() {
  const queryClient = useQueryClient()
  const [dryRun, setDryRun] = useState(true)
  const [range, setRange] = useState<TikTokCommentDateRange>("today")
  const [activityFilter, setActivityFilter] =
    useState<TikTokCommentActivityFilter>("all")
  const [activityView, setActivityView] = useState<"live" | "processed">("live")

  const statusQuery = useQuery({
    queryKey: ["tiktok-comment-agent-status"],
    queryFn: () => runServerAction(getTikTokCommentAgentStatusAction()),
  })

  const status = statusQuery.data
  const ready = status?.anthropicConfigured && status?.tiktokConfigured

  const metricsQuery = useQuery({
    queryKey: ["tiktok-comment-metrics", range],
    queryFn: () => runServerAction(getTikTokCommentDashboardMetricsAction(range)),
  })

  const activityQuery = useQuery({
    queryKey: ["tiktok-comment-activity", range, activityFilter],
    queryFn: () =>
      runServerAction(
        listTikTokCommentActivityAction({ range, filter: activityFilter })
      ),
    refetchInterval: 30_000,
  })

  const runsQuery = useQuery({
    queryKey: ["tiktok-comment-agent-runs"],
    queryFn: () => runServerAction(listTikTokCommentAgentRunsAction()),
    refetchInterval: 30_000,
  })

  const liveCommentsQuery = useQuery({
    queryKey: ["tiktok-live-comments"],
    queryFn: () => runServerAction(listTikTokLiveCommentsAction()),
    enabled: ready,
    refetchInterval: 60_000,
  })

  const invalidateDashboard = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["tiktok-comment-metrics"] }),
      queryClient.invalidateQueries({ queryKey: ["tiktok-comment-activity"] }),
      queryClient.invalidateQueries({ queryKey: ["tiktok-comment-agent-runs"] }),
      queryClient.invalidateQueries({ queryKey: ["tiktok-comment-agent-status"] }),
      queryClient.invalidateQueries({ queryKey: ["tiktok-live-comments"] }),
    ])
  }

  const runMutation = useMutation({
    mutationFn: () =>
      runServerAction(runTikTokCommentAgentNowAction({ dryRun })),
    onSuccess: invalidateDashboard,
  })

  const enableCommentsMutation = useMutation({
    mutationFn: () => runServerAction(enableTikTokSparkCommentsAction()),
    onSuccess: invalidateDashboard,
  })

  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-8 p-4 sm:p-6 lg:p-8">
      <div className="space-y-6 text-center">
        <p className="text-muted-foreground text-sm">
          <Link href="/tiktok" className="hover:text-foreground">
            TikTok
          </Link>
          <span className="mx-2">/</span>
          <span>Comentarios IA</span>
        </p>
        <div className="space-y-2">
          <h1 className="flex items-center justify-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <RiChat3Line className="size-8 text-rose-600" />
            Dashboard de comentarios TikTok
          </h1>
          <p className="text-muted-foreground mx-auto max-w-2xl text-sm sm:text-base">
            Claude modera comentarios de ads Spark de{" "}
            <span className="text-foreground font-medium">
              @Calzados_urbanos
            </span>{" "}
            y{" "}
            <span className="text-foreground font-medium">@Calzados Elite</span>
            : oculta spam, responde preguntas y deja pasar los positivos.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="bg-muted inline-flex rounded-lg p-1">
            <Button
              type="button"
              size="sm"
              variant={range === "today" ? "default" : "ghost"}
              onClick={() => setRange("today")}
            >
              <RiCalendarLine className="size-4" />
              Hoy
            </Button>
            <Button
              type="button"
              size="sm"
              variant={range === "7d" ? "default" : "ghost"}
              onClick={() => setRange("7d")}
            >
              7 días
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="dry-run-tiktok-comments"
              checked={dryRun}
              onCheckedChange={setDryRun}
            />
            <span className="text-sm">Dry run</span>
          </div>
          <Button type="button" variant="outline" asChild>
            <Link href="/meta/comentarios/configuracion">
              <RiSettings3Line className="size-4" />
              Config (Meta)
            </Link>
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/meta/comentarios/productos">
              <RiShoppingBag2Line className="size-4" />
              Productos (Meta)
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => enableCommentsMutation.mutate()}
            disabled={enableCommentsMutation.isPending || !ready}
          >
            <RiChatCheckLine className="size-4" />
            {enableCommentsMutation.isPending
              ? "Habilitando…"
              : "Habilitar comentarios Spark"}
          </Button>
          <Button
            type="button"
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending || !ready}
          >
            <RiPlayLine className="size-4" />
            {runMutation.isPending ? "Ejecutando…" : "Ejecutar ahora"}
          </Button>
        </div>
      </div>

      <TikTokCommentsStatus
        status={status}
        loading={statusQuery.isLoading}
      />

      <TikTokCommentsMetrics
        metrics={metricsQuery.data}
        loading={metricsQuery.isLoading}
      />

      <TikTokCommentsActivity
        items={activityQuery.data}
        liveItems={liveCommentsQuery.data?.comments}
        liveMeta={
          liveCommentsQuery.data
            ? {
                adsScanned: liveCommentsQuery.data.adsScanned,
                sparkTargetAds: liveCommentsQuery.data.sparkTargetAds,
                adgroupsScanned: liveCommentsQuery.data.adgroupsScanned,
                fetchErrors: liveCommentsQuery.data.fetchErrors,
              }
            : undefined
        }
        loading={activityQuery.isLoading}
        liveLoading={liveCommentsQuery.isLoading}
        filter={activityFilter}
        onFilterChange={setActivityFilter}
        view={activityView}
        onViewChange={setActivityView}
      />

      {enableCommentsMutation.data ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-card px-5 py-4 text-sm shadow-sm">
          <p className="font-medium">Comentarios habilitados en Spark</p>
          <p className="mt-1">
            Actualizados {enableCommentsMutation.data.updated} de{" "}
            {enableCommentsMutation.data.adgroupsTargeted} adgroups. Los
            comentarios nuevos de @Calzados_urbanos / @Calzados Elite ya pueden
            llegar a la API.
          </p>
          {enableCommentsMutation.data.failed.length > 0 ? (
            <p className="text-destructive mt-2 text-xs">
              Fallaron {enableCommentsMutation.data.failed.length}:{" "}
              {enableCommentsMutation.data.failed
                .slice(0, 2)
                .map((f) => f.error)
                .join(" · ")}
            </p>
          ) : null}
        </div>
      ) : null}

      {enableCommentsMutation.isError ? (
        <p className="text-destructive text-sm">
          {enableCommentsMutation.error instanceof Error
            ? enableCommentsMutation.error.message
            : "Error al habilitar comentarios"}
        </p>
      ) : null}

      <div className="rounded-2xl border bg-card px-5 py-4 text-sm shadow-sm">
        <p>
          Cron automático:{" "}
          <code className="text-xs">{TIKTOK_COMMENT_CRON_EXPRESSION}</code> · 12
          corridas por día
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          Ventana de comentarios: 7 días. Cada comentario se procesa una sola vez.
          Los prompts y productos se editan en Comentarios IA (Meta).
        </p>
      </div>

      {runMutation.data ? (
        <div className="rounded-2xl border border-primary/30 bg-card px-5 py-4 text-sm shadow-sm">
          <p className="font-medium">Última ejecución manual</p>
          <p className="mt-1">{runMutation.data.summary}</p>
        </div>
      ) : null}

      {runMutation.isError ? (
        <p className="text-destructive text-sm">
          {runMutation.error instanceof Error
            ? runMutation.error.message
            : "Error al ejecutar el agente"}
        </p>
      ) : null}

      <TikTokCommentsRuns runs={runsQuery.data} loading={runsQuery.isLoading} />

      <p className="text-muted-foreground text-center text-sm">
        <Link
          href="/tiktok"
          className="hover:text-foreground underline-offset-4 hover:underline"
        >
          ← Dashboard TikTok
        </Link>
      </p>
    </div>
  )
}
