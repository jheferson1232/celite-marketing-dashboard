"use client"

import { useState } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  RiCalendarLine,
  RiChat3Line,
  RiPlayLine,
  RiFlashlightLine,
  RiSettings3Line,
} from "@remixicon/react"
import { runServerAction } from "@/lib/server-action"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { META_COMMENT_CRON_EXPRESSION } from "@/lib/services/meta/comments/constants"
import type {
  MetaCommentActivityFilter,
  MetaCommentDateRange,
} from "@/lib/services/meta/comments/types"
import {
  getMetaCommentAgentStatusAction,
  getMetaCommentDashboardMetricsAction,
  listMetaCommentActivityAction,
  listMetaCommentAgentRunsAction,
  listMetaCommentPageConfigsAction,
  runMetaCommentAgentNowAction,
  updateMetaCommentPageReplyAction,
} from "../_actions/meta-comments-agent"
import { MetaCommentsActivity } from "./meta-comments-activity"
import { MetaCommentsMetrics } from "./meta-comments-metrics"
import { MetaCommentsReplyConfig } from "./meta-comments-reply-config"
import { MetaCommentsRuns } from "./meta-comments-runs"
import { MetaCommentsStatus } from "./meta-comments-status"
import { MetaFacebookConnect } from "./meta-facebook-connect"

export function MetaComentariosContent() {
  const queryClient = useQueryClient()
  const [dryRun, setDryRun] = useState(true)
  const [range, setRange] = useState<MetaCommentDateRange>("today")
  const [activityFilter, setActivityFilter] =
    useState<MetaCommentActivityFilter>("all")

  const statusQuery = useQuery({
    queryKey: ["meta-comment-agent-status"],
    queryFn: () => runServerAction(getMetaCommentAgentStatusAction()),
  })

  const metricsQuery = useQuery({
    queryKey: ["meta-comment-metrics", range],
    queryFn: () => runServerAction(getMetaCommentDashboardMetricsAction(range)),
  })

  const activityQuery = useQuery({
    queryKey: ["meta-comment-activity", range, activityFilter],
    queryFn: () =>
      runServerAction(
        listMetaCommentActivityAction({ range, filter: activityFilter })
      ),
    refetchInterval: 30_000,
  })

  const runsQuery = useQuery({
    queryKey: ["meta-comment-agent-runs"],
    queryFn: () => runServerAction(listMetaCommentAgentRunsAction()),
    refetchInterval: 30_000,
  })

  const pageConfigsQuery = useQuery({
    queryKey: ["meta-comment-page-configs"],
    queryFn: () => runServerAction(listMetaCommentPageConfigsAction()),
  })

  const status = statusQuery.data
  const ready = status?.anthropicConfigured && status?.oauthConnected

  const invalidateDashboard = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["meta-comment-metrics"] }),
      queryClient.invalidateQueries({ queryKey: ["meta-comment-activity"] }),
      queryClient.invalidateQueries({ queryKey: ["meta-comment-agent-runs"] }),
      queryClient.invalidateQueries({ queryKey: ["meta-comment-page-configs"] }),
      queryClient.invalidateQueries({ queryKey: ["meta-comment-agent-status"] }),
    ])
  }

  const runMutation = useMutation({
    mutationFn: () => runServerAction(runMetaCommentAgentNowAction({ dryRun })),
    onSuccess: invalidateDashboard,
  })

  const replyMutation = useMutation({
    mutationFn: (input: {
      pageId: string
      replyMode: "professional" | "friendly" | "concise"
      replyTemplate: string | null
      websiteUrl: string | null
    }) => runServerAction(updateMetaCommentPageReplyAction(input)),
    onSuccess: invalidateDashboard,
  })

  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-8 p-4 sm:p-6 lg:p-8">
      <div className="space-y-6 text-center">
        <p className="text-muted-foreground text-sm">
          <Link href="/dashboard" className="hover:text-foreground">
            Meta
          </Link>
          <span className="mx-2">/</span>
          <span>Comentarios IA</span>
        </p>
        <div className="space-y-2">
          <h1 className="flex items-center justify-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <RiChat3Line className="size-8 text-blue-600" />
            Dashboard de comentarios
          </h1>
          <p className="text-muted-foreground mx-auto max-w-2xl text-sm sm:text-base">
            Claude modera comentarios de tus anuncios: oculta spam, responde
            preguntas y deja pasar los positivos. Automático cada 2 horas.
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
              id="dry-run-meta-comments"
              checked={dryRun}
              onCheckedChange={setDryRun}
            />
            <span className="text-sm">Dry run</span>
          </div>
          <Button type="button" variant="outline" asChild>
            <Link href="/meta/comentarios/configuracion">
              <RiSettings3Line className="size-4" />
              Configuración
            </Link>
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/meta/comentarios/configuracion/prueba">
              <RiFlashlightLine className="size-4" />
              Probar asistente
            </Link>
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

      <MetaCommentsStatus
        status={status}
        loading={statusQuery.isLoading}
      />

      <MetaFacebookConnect onConnectionChange={invalidateDashboard} />

      <MetaCommentsMetrics
        metrics={metricsQuery.data}
        loading={metricsQuery.isLoading}
      />

      <MetaCommentsActivity
        items={activityQuery.data}
        loading={activityQuery.isLoading}
        filter={activityFilter}
        onFilterChange={setActivityFilter}
      />

      <MetaCommentsReplyConfig
        pages={pageConfigsQuery.data}
        loading={pageConfigsQuery.isLoading}
        busy={replyMutation.isPending}
        onSave={async (input) => {
          await replyMutation.mutateAsync(input)
        }}
      />

      <div className="rounded-2xl border bg-card px-5 py-4 text-sm shadow-sm">
        <p>
          Cron automático:{" "}
          <code className="text-xs">{META_COMMENT_CRON_EXPRESSION}</code> · 12
          corridas por día
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          Ventana de comentarios: 24h. Cada comentario se procesa una sola vez.
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

      <MetaCommentsRuns runs={runsQuery.data} loading={runsQuery.isLoading} />

      <p className="text-muted-foreground text-center text-sm">
        <Link
          href="/dashboard"
          className="hover:text-foreground underline-offset-4 hover:underline"
        >
          ← Dashboard Meta
        </Link>
      </p>
    </div>
  )
}
