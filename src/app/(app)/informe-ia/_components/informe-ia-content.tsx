"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  RiAlertLine,
  RiArrowDownSLine,
  RiArrowRightSLine,
  RiEyeLine,
  RiRefreshLine,
  RiSendPlaneLine,
} from "@remixicon/react"
import {
  MetaAccountSelect,
  useMetaDashboardAccount,
} from "@/app/(app)/dashboard/_components/meta-dashboard-account"
import { MetaConfigErrorHint } from "@/components/meta-config-error-hint"
import { MetaApiStatusIndicator } from "@/components/meta-api-status-indicator"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getMetaInformeApiStatus } from "@/lib/meta-api-status"
import { isMetaConfigError } from "@/lib/services/meta/meta-errors"
import { runServerAction } from "@/lib/server-action"
import type { MetaInformePayload } from "@/lib/services/meta/meta-operative-service"
import {
  getMetaInformeAction,
  previewMetaInformeHourlyAction,
  sendMetaInformeHourlyToTelegramAction,
  setInformeAdsetStatusAction,
  setInformeCpaTargetAction,
  syncMetaInformeAction,
} from "../_actions/meta-informe"
import { InformeActions } from "./informe-actions"
import { InformeCpaTarget } from "./informe-cpa-target"
import { InformeKpis } from "./informe-kpis"
import { InformeMatrix } from "./informe-matrix"
import { InformeSide } from "./informe-side"

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}

export function InformeIaContent() {
  const queryClient = useQueryClient()
  const { accounts, accountId, setAccountId, isLoading: accountsLoading } =
    useMetaDashboardAccount()
  const [matrixOpen, setMatrixOpen] = useState(false)
  const [telegramText, setTelegramText] = useState<string | null>(null)
  const [telegramSent, setTelegramSent] = useState<number | null>(null)

  const queryKey = ["meta-informe-ia", accountId] as const

  const informeQuery = useQuery({
    queryKey,
    queryFn: () => runServerAction(getMetaInformeAction(accountId!)),
    enabled: Boolean(accountId),
    staleTime: 2 * 60 * 1000,
  })

  const syncMutation = useMutation({
    mutationFn: () => runServerAction(syncMetaInformeAction(accountId!)),
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  })

  const targetMutation = useMutation({
    mutationFn: (cpaTarget: number) =>
      runServerAction(setInformeCpaTargetAction({ accountId: accountId!, cpaTarget })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const statusMutation = useMutation({
    mutationFn: (input: { adsetId: string; status: "ACTIVE" | "PAUSED" }) =>
      runServerAction(
        setInformeAdsetStatusAction({ accountId: accountId!, ...input })
      ),
    onSuccess: () => syncMutation.mutate(),
  })

  const previewMutation = useMutation({
    mutationFn: () => runServerAction(previewMetaInformeHourlyAction()),
    onSuccess: (result) => {
      setTelegramText(result?.text ?? null)
      setTelegramSent(null)
    },
  })

  const sendMutation = useMutation({
    mutationFn: () => runServerAction(sendMetaInformeHourlyToTelegramAction()),
    onSuccess: (result) => {
      setTelegramText(result?.text ?? null)
      setTelegramSent(result?.sent ?? 0)
    },
  })

  const data: MetaInformePayload | undefined = informeQuery.data
  const telegramPending = previewMutation.isPending || sendMutation.isPending
  const telegramError = previewMutation.error ?? sendMutation.error

  const metaApiStatus = useMemo(
    () =>
      getMetaInformeApiStatus({
        informe: {
          isLoading: informeQuery.isLoading,
          isFetching: informeQuery.isFetching,
          isError: informeQuery.isError || syncMutation.isError,
          isSuccess: informeQuery.isSuccess && !syncMutation.isError,
          error:
            (informeQuery.error as Error | null) ??
            (syncMutation.error as Error | null),
        },
        isSyncing: syncMutation.isPending,
        hourlyError: telegramError ? errorText(telegramError, "") : null,
      }),
    [
      informeQuery.isLoading,
      informeQuery.isFetching,
      informeQuery.isError,
      informeQuery.isSuccess,
      informeQuery.error,
      syncMutation.isError,
      syncMutation.isPending,
      syncMutation.error,
      telegramError,
    ]
  )

  return (
    <div className="mx-auto flex w-full max-w-[1400px] min-w-0 flex-col gap-4 p-4 pb-10 sm:p-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Informe IA</h1>
          <MetaAccountSelect
            accounts={accounts}
            value={accountId}
            onChange={setAccountId}
            disabled={accountsLoading}
          />
          <MetaApiStatusIndicator status={metaApiStatus} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data ? (
            <InformeCpaTarget
              key={`${data.account.accountId}:${data.cpaTarget}`}
              value={data.cpaTarget}
              currency={data.account.currency}
              accountName={data.account.name}
              saving={targetMutation.isPending}
              error={
                targetMutation.isError
                  ? errorText(targetMutation.error, "No se pudo guardar")
                  : null
              }
              onSave={(value) => targetMutation.mutate(value)}
            />
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || !accountId}
          >
            <RiRefreshLine
              className={syncMutation.isPending ? "size-4 animate-spin" : "size-4"}
            />
            Sincronizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => previewMutation.mutate()}
            disabled={telegramPending}
          >
            <RiEyeLine className="size-4" />
            Vista previa
          </Button>
          <Button
            size="sm"
            onClick={() => sendMutation.mutate()}
            disabled={telegramPending}
          >
            <RiSendPlaneLine className="size-4" />
            {sendMutation.isPending ? "Enviando…" : "Enviar a Telegram"}
          </Button>
        </div>
      </header>

      <p className="text-muted-foreground -mt-2 text-xs">
        Telegram 8:00 y 20:00 (Lima) con todas las cuentas: qué apagar, revisar y
        reactivar según el CPA objetivo de cada una.
      </p>

      {data?.account.statusLabel ? (
        <div className="flex gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm">
          <RiAlertLine className="mt-0.5 size-4 shrink-0 text-red-600" />
          <p>
            <span className="font-medium">
              {data.account.name}: {data.account.statusLabel}.
            </span>{" "}
            <span className="text-muted-foreground">
              Meta no entrega gasto de esta cuenta; elige otra en el selector.
            </span>
          </p>
        </div>
      ) : null}

      {telegramPending ? (
        <p className="text-muted-foreground text-xs">
          Armando el informe de todas las cuentas… puede tardar hasta 1 minuto.
        </p>
      ) : null}
      {telegramError ? (
        <p className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-sm">
          {errorText(telegramError, "No se pudo generar el informe de Telegram.")}
        </p>
      ) : null}
      {targetMutation.isError ? (
        <p className="text-destructive text-sm">
          {errorText(targetMutation.error, "No se pudo guardar el CPA objetivo.")}
        </p>
      ) : null}
      {telegramText ? (
        <div className="bg-muted/30 rounded-lg border px-4 py-3 text-sm whitespace-pre-wrap">
          <p className="text-muted-foreground mb-2 text-xs font-medium">
            {telegramSent === null
              ? "Vista previa del mensaje de Telegram"
              : telegramSent > 0
                ? `Enviado a ${telegramSent} chat(s) de Telegram`
                : "No se envió: revisa TELEGRAM_BOT_TOKEN y TELEGRAM_ALLOWED_USER_IDS"}
          </p>
          {telegramText}
        </div>
      ) : null}

      {!accountId || informeQuery.isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-20 w-full rounded-xl" />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      ) : informeQuery.isError ? (
        <div className="border-destructive/30 bg-destructive/5 rounded-lg border px-4 py-3 text-sm">
          <p className="text-destructive font-medium">
            {isMetaConfigError(informeQuery.error)
              ? "Meta no está configurado en este entorno."
              : "No se pudo cargar el informe."}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {errorText(informeQuery.error, "Revisa Meta y la base de datos.")}
          </p>
          {isMetaConfigError(informeQuery.error) ? <MetaConfigErrorHint /> : null}
        </div>
      ) : data ? (
        <>
          <InformeKpis data={data} />

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-2">
              <h2 className="text-sm font-semibold">
                Qué hacer ahora
                {data.actions.length > 0 ? ` · ${data.actions.length}` : ""}
              </h2>
              <InformeActions
                data={data}
                onChangeStatus={(input) => statusMutation.mutate(input)}
                pendingAdsetId={
                  statusMutation.isPending
                    ? (statusMutation.variables?.adsetId ?? null)
                    : null
                }
                error={
                  statusMutation.isError
                    ? errorText(statusMutation.error, "No se pudo cambiar el conjunto.")
                    : null
                }
              />
            </div>
            <InformeSide data={data} />
          </div>

          <section className="flex min-w-0 flex-col gap-2">
            <button
              type="button"
              onClick={() => setMatrixOpen((open) => !open)}
              aria-expanded={matrixOpen}
              className="hover:text-foreground text-muted-foreground flex w-fit items-center gap-1 text-sm font-medium"
            >
              {matrixOpen ? (
                <RiArrowDownSLine className="size-4" />
              ) : (
                <RiArrowRightSLine className="size-4" />
              )}
              Tabla por campaña y día · {data.groups.length} campaña
              {data.groups.length === 1 ? "" : "s"}
            </button>
            {matrixOpen ? (
              data.groups.length === 0 ? (
                <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm">
                  Ninguna campaña con gasto en los últimos {data.dateKeys.length} días.
                </p>
              ) : (
                <InformeMatrix data={data} />
              )
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  )
}
