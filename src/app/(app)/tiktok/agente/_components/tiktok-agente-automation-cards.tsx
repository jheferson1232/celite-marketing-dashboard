"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { runServerAction } from "@/lib/server-action"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RiArrowUpCircleLine, RiAlarmLine, RiCloseLine } from "@remixicon/react"
import type { TikTokAgentThresholds } from "@/lib/services/tiktok/agent/types"
import {
  listPendingActivateCampaignsAction,
  removePendingActivateCampaignAction,
} from "../../_actions/pending-6am"
import { saveTikTokAgentThresholdsAction } from "../_actions/tiktok-agent"

interface TikTokAgenteAutomationCardsProps {
  settings: TikTokAgentThresholds
}

export function TikTokAgenteAutomationCards({
  settings,
}: TikTokAgenteAutomationCardsProps) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<{
    activateAt6amEnabled: boolean
    scaleBestEnabled: boolean
    scaleBestBudgetIncreasePercent: string
  } | null>(null)
  const [feedback, setFeedback] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  const form = draft ?? {
    activateAt6amEnabled: settings.activateAt6amEnabled,
    scaleBestEnabled: settings.scaleBestEnabled,
    scaleBestBudgetIncreasePercent: String(
      settings.scaleBestBudgetIncreasePercent
    ),
  }

  const pendingQuery = useQuery({
    queryKey: ["tiktok-pending-activate-6am"],
    queryFn: () => runServerAction(listPendingActivateCampaignsAction()),
    enabled: form.activateAt6amEnabled || settings.activateAt6amEnabled,
  })

  const saveMutation = useMutation({
    mutationFn: () => {
      const percent = Number(form.scaleBestBudgetIncreasePercent.trim())
      if (!Number.isFinite(percent) || percent < 1 || percent > 200) {
        throw new Error("% de aumento: ingresá un número entre 1 y 200.")
      }
      return runServerAction(
        saveTikTokAgentThresholdsAction({
          activateAt6amEnabled: form.activateAt6amEnabled,
          scaleBestEnabled: form.scaleBestEnabled,
          scaleBestBudgetIncreasePercent: Math.round(percent * 100) / 100,
        })
      )
    },
    onSuccess: async () => {
      setDraft(null)
      setFeedback({
        type: "success",
        message: "Automatizaciones guardadas.",
      })
      await queryClient.invalidateQueries({
        queryKey: ["tiktok-agent-thresholds"],
      })
      await queryClient.invalidateQueries({
        queryKey: ["tiktok-pending-activate-6am"],
      })
    },
    onError: (error) => {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudieron guardar las automatizaciones.",
      })
    },
  })

  const removeMutation = useMutation({
    mutationFn: (campaignId: string) =>
      runServerAction(removePendingActivateCampaignAction(campaignId)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["tiktok-pending-activate-6am"],
      })
    },
  })

  const pending = pendingQuery.data ?? []

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RiAlarmLine className="size-4" />
            Activación 6:00 AM
          </CardTitle>
          <CardDescription>
            Con esto encendido, al activar una campaña en el dashboard{" "}
            <strong>no se prende ahora</strong>: queda en cola y se enciende a
            las <strong>6:00 America/Lima</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Diferir activaciones a las 6:00</p>
              <p className="text-muted-foreground text-xs">
                Cron UTC <code className="text-[10px]">11:00</code> · solo si
                está encendido
              </p>
            </div>
            <Switch
              checked={form.activateAt6amEnabled}
              onCheckedChange={(checked) =>
                setDraft({ ...form, activateAt6amEnabled: checked })
              }
            />
          </div>
          {form.activateAt6amEnabled ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                En cola ({pending.length})
              </p>
              {pendingQuery.isLoading ? (
                <p className="text-muted-foreground text-xs">Cargando…</p>
              ) : pending.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  Ninguna. Activá campañas desde TikTok → Dashboard; quedarán
                  aquí hasta las 6:00.
                </p>
              ) : (
                <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
                  {pending.map((item) => (
                    <li
                      key={item.campaignId}
                      className="bg-muted/50 flex items-center justify-between gap-2 rounded-md px-2 py-1.5"
                    >
                      <span className="min-w-0 truncate font-medium">
                        {item.name}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-6 shrink-0"
                        disabled={removeMutation.isPending}
                        aria-label={`Quitar ${item.name} de la cola`}
                        onClick={() => removeMutation.mutate(item.campaignId)}
                      >
                        <RiCloseLine className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">
              Apagado: el switch del dashboard activa en TikTok al instante.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RiArrowUpCircleLine className="size-4" />
            Escalar mejor resultado
          </CardTitle>
          <CardDescription>
            En cada corrida del agente (8 / 14 / 20 h), sube el presupuesto
            diario del <strong>conjunto</strong> con más compras hoy (mejor CPA
            como desempate) y te avisa por <strong>Telegram</strong> cuál fue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Escalar automáticamente</p>
              <p className="text-muted-foreground text-xs">
                Requiere notificación Telegram del agente activa
              </p>
            </div>
            <Switch
              checked={form.scaleBestEnabled}
              onCheckedChange={(checked) =>
                setDraft({ ...form, scaleBestEnabled: checked })
              }
            />
          </div>
          <div className="space-y-2">
            <span className="text-sm font-medium">
              Aumento de presupuesto diario (%)
            </span>
            <Input
              type="number"
              min={1}
              max={200}
              step={1}
              value={form.scaleBestBudgetIncreasePercent}
              onChange={(e) =>
                setDraft({
                  ...form,
                  scaleBestBudgetIncreasePercent: e.target.value,
                })
              }
              disabled={!form.scaleBestEnabled}
            />
            <p className="text-muted-foreground text-xs">
              Ej. 20 = subir un 20% el presupuesto del ganador del día.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="lg:col-span-2 flex flex-wrap items-center gap-3">
        {feedback ? (
          <p
            className={
              feedback.type === "success"
                ? "text-sm text-green-600 dark:text-green-400"
                : "text-destructive text-sm"
            }
            role="status"
          >
            {feedback.message}
          </p>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          disabled={saveMutation.isPending}
          onClick={() => {
            setFeedback(null)
            saveMutation.mutate()
          }}
        >
          {saveMutation.isPending
            ? "Guardando…"
            : "Guardar automatizaciones"}
        </Button>
      </div>
    </div>
  )
}
