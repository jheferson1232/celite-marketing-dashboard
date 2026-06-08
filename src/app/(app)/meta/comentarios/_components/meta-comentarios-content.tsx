"use client"

import { useState } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import {
  RiChat3Line,
  RiPlayLine,
  RiShieldCheckLine,
} from "@remixicon/react"
import { runServerAction } from "@/lib/server-action"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import {
  META_COMMENT_CRON_EXPRESSION,
  META_COMMENT_TRIGGER_LABEL,
} from "@/lib/services/meta/comments/constants"
import {
  getMetaCommentAgentStatusAction,
  listMetaCommentAgentRunsAction,
  listMetaCommentDecisionsAction,
  runMetaCommentAgentNowAction,
} from "../_actions/meta-comments-agent"

function formatRunWhen(iso: string): string {
  const date = new Date(iso)
  const relative = formatDistanceToNow(date, { addSuffix: true, locale: es })
  const absolute = date.toLocaleString("es-CO", {
    timeZone: "America/Bogota",
  })
  return `${relative}\n${absolute}`
}

function actionBadge(action: string) {
  if (action === "hide") {
    return (
      <Badge variant="destructive" className="text-[10px]">
        🔇 HIDE
      </Badge>
    )
  }
  if (action === "reply") {
    return (
      <Badge variant="default" className="text-[10px]">
        💬 REPLY
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-[10px]">
      ✓ SKIP
    </Badge>
  )
}

export function MetaComentariosContent() {
  const queryClient = useQueryClient()
  const [dryRun, setDryRun] = useState(true)

  const statusQuery = useQuery({
    queryKey: ["meta-comment-agent-status"],
    queryFn: () => runServerAction(getMetaCommentAgentStatusAction()),
  })

  const runsQuery = useQuery({
    queryKey: ["meta-comment-agent-runs"],
    queryFn: () => runServerAction(listMetaCommentAgentRunsAction()),
    refetchInterval: 30_000,
  })

  const decisionsQuery = useQuery({
    queryKey: ["meta-comment-decisions"],
    queryFn: () => runServerAction(listMetaCommentDecisionsAction()),
    refetchInterval: 30_000,
  })

  const runMutation = useMutation({
    mutationFn: () => runServerAction(runMetaCommentAgentNowAction({ dryRun })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["meta-comment-agent-runs"] })
      void queryClient.invalidateQueries({ queryKey: ["meta-comment-decisions"] })
    },
  })

  const status = statusQuery.data
  const ready =
    status?.anthropicConfigured &&
    status?.metaConfigured &&
    status?.pageTokenConfigured

  return (
    <div className="flex w-full min-w-0 flex-col gap-6 p-4 sm:gap-8 sm:p-6 lg:p-8">
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-muted-foreground text-sm">
          <Link href="/dashboard" className="hover:text-foreground">
            Meta
          </Link>
          <span className="mx-2">/</span>
          <span>Comentarios IA</span>
        </p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
              <RiChat3Line className="size-7" />
              Agente de comentarios
            </h1>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
              Claude lee comentarios nuevos en tus ads de Facebook, clasifica y
              actúa: oculta spam y trolls, responde preguntas reales en español,
              deja pasar los positivos. Corre{" "}
              <strong>cada 2 horas</strong> o manualmente.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="dry-run-meta-comments"
                checked={dryRun}
                onCheckedChange={setDryRun}
              />
              <span className="text-sm">Dry run (sin mutar)</span>
            </div>
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
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <RiShieldCheckLine className="size-4" />
            Accesos y configuración
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {statusQuery.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : status ? (
            <>
              <div className="grid gap-2 sm:grid-cols-3">
                <StatusPill
                  label="Anthropic Claude"
                  ok={status.anthropicConfigured}
                  env="ANTHROPIC_API_KEY"
                />
                <StatusPill
                  label="Meta Ads"
                  ok={status.metaConfigured}
                  env="META_ACCESS_TOKEN"
                />
                <StatusPill
                  label="Token de Página"
                  ok={status.pageTokenConfigured}
                  env="META_PAGE_ACCESS_TOKEN"
                />
              </div>
              {status.pageCount > 0 ? (
                <p className="text-muted-foreground text-xs">
                  Páginas detectadas: {status.pageNames.join(", ")}
                </p>
              ) : null}
              {status.missing.length > 0 ? (
                <p className="text-destructive text-xs">
                  Falta configurar: {status.missing.join(", ")}. Sin token de
                  Página no se pueden ocultar ni responder comentarios.
                </p>
              ) : (
                <p className="text-green-600 text-xs dark:text-green-400">
                  Listo para ejecutar (con dry run desactivado aplica cambios en
                  Facebook).
                </p>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Horario</CardTitle>
            <CardDescription>🕐 Cada 2 horas · 12 corridas/día</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <p>
              Cron en UTC:{" "}
              <code className="text-xs">{META_COMMENT_CRON_EXPRESSION}</code>
            </p>
            <p className="text-muted-foreground mt-2 text-xs">
              Ventana: últimas 24h por corrida. Idempotente: cada comentario se
              procesa una sola vez (dedupe por metaCommentId).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Reglas de Claude</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <ul className="list-inside list-disc space-y-1">
              <li>
                spam + troll → <strong>🔇 HIDE</strong>
              </li>
              <li>
                question → <strong>💬 REPLY</strong> en español (máx 150 chars)
              </li>
              <li>
                positive + neutral → <strong>✓ SKIP</strong>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {runMutation.data ? (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Última ejecución manual</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>{runMutation.data.summary}</p>
            <p className="text-muted-foreground mt-1">
              {runMutation.data.commentsSeen} comentario(s) ·{" "}
              {runMutation.data.actionsCount} acción(es)
            </p>
          </CardContent>
        </Card>
      ) : null}

      {runMutation.isError ? (
        <p className="text-destructive text-sm">
          {runMutation.error instanceof Error
            ? runMutation.error.message
            : "Error al ejecutar el agente"}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimas 20 corridas</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0 sm:p-6 sm:pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cuándo</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Páginas</TableHead>
                <TableHead className="text-right">Posts</TableHead>
                <TableHead className="text-right">Comentarios</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runsQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ) : runsQuery.data?.length ? (
                runsQuery.data.map((run) => (
                  <TableRow key={run.runId}>
                    <TableCell className="whitespace-pre-line text-xs">
                      {formatRunWhen(run.startedAt)}
                    </TableCell>
                    <TableCell>
                      {META_COMMENT_TRIGGER_LABEL[run.trigger] ?? run.trigger}
                      {run.dryRun ? (
                        <Badge variant="outline" className="ml-1 text-[10px]">
                          dry
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          run.status === "success"
                            ? "default"
                            : run.status === "failed"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {run.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {run.pagesScanned}
                    </TableCell>
                    <TableCell className="text-right">
                      {run.postsScanned}
                    </TableCell>
                    <TableCell className="text-right">
                      {run.commentsSeen}
                    </TableCell>
                    <TableCell className="text-right">
                      {run.actionsCount}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-muted-foreground text-center"
                  >
                    Aún no hay corridas. Ejecutá una manual o esperá el cron.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Últimas decisiones ({decisionsQuery.data?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0 sm:p-6 sm:pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cuándo</TableHead>
                <TableHead>Autor</TableHead>
                <TableHead>Comentario</TableHead>
                <TableHead>Clase</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Respuesta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {decisionsQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ) : decisionsQuery.data?.length ? (
                decisionsQuery.data.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-pre-line text-xs">
                      {formatRunWhen(row.createdAt)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.authorName ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate text-xs">
                      {row.message}
                    </TableCell>
                    <TableCell className="text-xs">{row.classification}</TableCell>
                    <TableCell>{actionBadge(row.action)}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs">
                      {row.replyText ?? (row.applied ? "✓" : row.errorMessage ?? "—")}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-muted-foreground text-center"
                  >
                    Cuando el agente procese su primer comentario aparece acá.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-sm">
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

function StatusPill({
  label,
  ok,
  env,
}: {
  label: string
  ok: boolean
  env: string
}) {
  return (
    <div
      className={
        ok
          ? "rounded-md border border-green-500/30 bg-green-500/5 px-3 py-2"
          : "rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2"
      }
    >
      <p className="font-medium">{label}</p>
      <p className="text-muted-foreground text-xs">
        {ok ? "OK" : `Falta ${env}`}
      </p>
    </div>
  )
}
