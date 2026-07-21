"use client"

import { useState } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { runServerAction } from "@/lib/server-action"
import { formatCurrency } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
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
  RiPlayLine,
  RiRobotLine,
  RiTelegramLine,
} from "@remixicon/react"
import { TIKTOK_AGENT_TRIGGER_LABEL } from "@/lib/services/tiktok/agent/constants"
import { TikTokAgenteAutomationCards } from "./tiktok-agente-automation-cards"
import {
  getTikTokAgentTelegramStatusAction,
  getTikTokAgentThresholdsAction,
  listTikTokAgentRunsAction,
  runTikTokAgentNowAction,
  saveTikTokAgentThresholdsAction,
} from "../_actions/tiktok-agent"

function parseThresholdInput(raw: string, label: string): number {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error(`${label}: ingresá un valor en soles.`)
  }
  const value = Number(trimmed)
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label}: debe ser un número ≥ 0.`)
  }
  return Math.round(value * 100) / 100
}

function formatRunWhen(iso: string): string {
  const date = new Date(iso)
  const relative = formatDistanceToNow(date, { addSuffix: true, locale: es })
  const absolute = date.toLocaleString("es-PE", {
    timeZone: "America/Lima",
  })
  return `${relative}\n${absolute}`
}

export function TikTokAgenteContent() {
  const queryClient = useQueryClient()
  const [dryRun, setDryRun] = useState(true)
  const [draft, setDraft] = useState<{
    adsetPauseSpendPen: string
    campaignPauseSpendPen: string
    adsetCpaCriticoPen: string
    telegramNotify: boolean
  } | null>(null)
  const [saveFeedback, setSaveFeedback] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  const thresholdsQuery = useQuery({
    queryKey: ["tiktok-agent-thresholds"],
    queryFn: () => runServerAction(getTikTokAgentThresholdsAction()),
  })

  const telegramQuery = useQuery({
    queryKey: ["tiktok-agent-telegram"],
    queryFn: () => runServerAction(getTikTokAgentTelegramStatusAction()),
  })

  const runsQuery = useQuery({
    queryKey: ["tiktok-agent-runs"],
    queryFn: () => runServerAction(listTikTokAgentRunsAction()),
    refetchInterval: 30_000,
  })

  const thresholds = thresholdsQuery.data
  const form = draft ?? {
    adsetPauseSpendPen: String(thresholds?.adsetPauseSpendPen ?? ""),
    campaignPauseSpendPen: String(thresholds?.campaignPauseSpendPen ?? ""),
    adsetCpaCriticoPen: String(thresholds?.adsetCpaCriticoPen ?? ""),
    telegramNotify: thresholds?.telegramNotify ?? true,
  }

  const thresholdsReady =
    thresholdsQuery.isSuccess && thresholdsQuery.data != null

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        adsetPauseSpendPen: parseThresholdInput(
          form.adsetPauseSpendPen,
          "Gasto conjunto sin compras"
        ),
        campaignPauseSpendPen: parseThresholdInput(
          form.campaignPauseSpendPen,
          "Gasto campaña sin compras"
        ),
        adsetCpaCriticoPen: parseThresholdInput(
          form.adsetCpaCriticoPen,
          "CPA crítico"
        ),
        telegramNotify: form.telegramNotify,
      }
      return runServerAction(saveTikTokAgentThresholdsAction(payload))
    },
    onSuccess: async (saved) => {
      setDraft(null)
      if (!saved) return
      setSaveFeedback({
        type: "success",
        message: `Umbrales guardados (conjunto S/ ${saved.adsetPauseSpendPen}, campaña S/ ${saved.campaignPauseSpendPen}, CPA S/ ${saved.adsetCpaCriticoPen}).`,
      })
      await queryClient.invalidateQueries({
        queryKey: ["tiktok-agent-thresholds"],
      })
    },
    onError: (error) => {
      setSaveFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudieron guardar los umbrales.",
      })
    },
  })

  const runMutation = useMutation({
    mutationFn: () => runServerAction(runTikTokAgentNowAction({ dryRun })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tiktok-agent-runs"] })
    },
  })

  return (
    <div className="flex w-full min-w-0 flex-col gap-6 p-4 sm:gap-8 sm:p-6 lg:p-8">
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-muted-foreground text-sm">
          <Link href="/tiktok" className="hover:text-foreground">
            TikTok
          </Link>
          <span className="mx-2">/</span>
          <span>Agente automático</span>
        </p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
              <RiRobotLine className="size-7" />
              Agente automático
            </h1>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
              Revisa campañas y conjuntos TikTok <strong>3 veces al día</strong> y
              pausa según umbrales (gasto sin compras, CPA alto). Cada corrida queda
              registrada para auditoría.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="dry-run"
                checked={dryRun}
                onCheckedChange={setDryRun}
              />
              <span className="text-sm">Dry run (sin mutar)</span>
            </div>
            <Button
              type="button"
              onClick={() => runMutation.mutate()}
              disabled={runMutation.isPending}
            >
              <RiPlayLine className="size-4" />
              {runMutation.isPending ? "Ejecutando…" : "Ejecutar ahora"}
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Horarios fijos</CardTitle>
          <CardDescription>
            America/Lima (misma zona que Bogotá UTC−5)
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <ul className="list-inside list-disc space-y-1">
            <li>
              <strong>6:00</strong> campañas en cola (si «Activación 6:00» está on)
            </li>
            <li>
              <strong>8:00</strong> · <strong>14:00</strong> ·{" "}
              <strong>20:00</strong> pausas / escalado · hora local
            </li>
            <li>
              Cron en UTC: <code className="text-xs">11:00</code> (6 AM) ·{" "}
              <code className="text-xs">13:00</code> /{" "}
              <code className="text-xs">19:00</code> /{" "}
              <code className="text-xs">01:00</code> (día siguiente). Podés
              disparar manual entre medio con &quot;Ejecutar ahora&quot;.
            </li>
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Umbrales (soles)</CardTitle>
            <CardDescription>
              Misma moneda que el dashboard TikTok (
              {formatCurrency(1, "PEN")}). Los gastos y CPA del informe de hoy
              se comparan directo en PEN.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {thresholdsQuery.isError ? (
              <p className="text-destructive text-sm">
                No se pudieron cargar los umbrales:{" "}
                {thresholdsQuery.error instanceof Error
                  ? thresholdsQuery.error.message
                  : "error desconocido"}
                . Si menciona la tabla TikTokAgentSettings, ejecutá{" "}
                <code className="text-xs">pnpm prisma migrate deploy</code>.
              </p>
            ) : null}
            {thresholdsQuery.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : thresholdsReady ? (
              <>
                <div className="space-y-2">
                  <span className="text-sm font-medium">
                    Pausar conjunto: gasto hoy sin compras ≥
                  </span>
                  <Input
                    id="adset-spend"
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.adsetPauseSpendPen}
                    onChange={(e) =>
                      setDraft({ ...form, adsetPauseSpendPen: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-sm font-medium">
                    Pausar campaña completa: gasto hoy sin compras ≥
                  </span>
                  <Input
                    id="campaign-spend"
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.campaignPauseSpendPen}
                    onChange={(e) =>
                      setDraft({
                        ...form,
                        campaignPauseSpendPen: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-sm font-medium">
                    Pausar conjunto activo: CPA hoy ≥
                  </span>
                  <Input
                    id="cpa-critico"
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.adsetCpaCriticoPen}
                    onChange={(e) =>
                      setDraft({ ...form, adsetCpaCriticoPen: e.target.value })
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">Resumen por Telegram</span>
                  <Switch
                    id="telegram-notify"
                    checked={form.telegramNotify}
                    onCheckedChange={(checked) =>
                      setDraft({ ...form, telegramNotify: checked })
                    }
                  />
                </div>
                {saveFeedback ? (
                  <p
                    className={
                      saveFeedback.type === "success"
                        ? "text-sm text-green-600 dark:text-green-400"
                        : "text-destructive text-sm"
                    }
                    role="status"
                  >
                    {saveFeedback.message}
                  </p>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saveMutation.isPending || !thresholdsReady}
                  onClick={() => {
                    setSaveFeedback(null)
                    saveMutation.mutate()
                  }}
                >
                  {saveMutation.isPending ? "Guardando…" : "Guardar umbrales"}
                </Button>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RiTelegramLine className="size-4" />
              Telegram
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {telegramQuery.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : telegramQuery.data?.configured ? (
              <div className="space-y-1 text-green-600 dark:text-green-400">
                <p>Configurado · mismo bot que Informe IA.</p>
                {telegramQuery.data.allowedUserCount > 0 ? (
                  <p className="text-muted-foreground text-xs">
                    {telegramQuery.data.allowedUserCount} ID(s) en{" "}
                    <code>TELEGRAM_ALLOWED_USER_IDS</code>
                  </p>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    {telegramQuery.data.sessionChatCount} chat(s) del bot en la
                    base (sin variable de entorno de IDs).
                  </p>
                )}
              </div>
            ) : telegramQuery.data?.botTokenSet ? (
              <div className="text-muted-foreground space-y-2">
                <p>
                  Token del bot presente, pero no hay destinatarios: agregá tu ID
                  en <code className="text-xs">TELEGRAM_ALLOWED_USER_IDS</code>{" "}
                  (como en Informe IA) o escribile al bot en Telegram para
                  registrar la sesión.
                </p>
              </div>
            ) : (
              <div className="text-muted-foreground space-y-2">
                <p>
                  Falta <code className="text-xs">TELEGRAM_BOT_TOKEN</code> en
                  este entorno (local o Vercel). Si en producción ya recibís el
                  informe Meta, copiá las mismas variables aquí.
                </p>
                <p>
                  Sin Telegram igual podés ejecutar el agente; no se enviará
                  resumen automático.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {thresholdsReady && thresholds ? (
        <TikTokAgenteAutomationCards settings={thresholds} />
      ) : thresholdsQuery.isLoading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : null}

      {runMutation.data && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Última ejecución manual</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>{runMutation.data.summary}</p>
            <p className="text-muted-foreground mt-1">
              {runMutation.data.actionsCount} acción(es) ·{" "}
              <Link
                href={`/tiktok/agente/runs/${runMutation.data.runId}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                Ver detalle →
              </Link>
            </p>
          </CardContent>
        </Card>
      )}

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
                <TableHead className="text-right">Cuentas</TableHead>
                <TableHead className="text-right">Campañas</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
                <TableHead>Detalle</TableHead>
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
                      {TIKTOK_AGENT_TRIGGER_LABEL[run.trigger] ?? run.trigger}
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
                      {run.accountsScanned}
                    </TableCell>
                    <TableCell className="text-right">
                      {run.campaignsScanned}
                    </TableCell>
                    <TableCell className="text-right">
                      {run.actionsCount}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/tiktok/agente/runs/${run.runId}`}
                        className="text-primary text-sm underline-offset-4 hover:underline"
                      >
                        Ver →
                      </Link>
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

      <p className="text-muted-foreground text-sm">
        <Link href="/tiktok" className="hover:text-foreground underline-offset-4 hover:underline">
          ← Dashboard TikTok
        </Link>
      </p>
    </div>
  )
}
