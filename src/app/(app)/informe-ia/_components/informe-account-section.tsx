"use client"

import { useState } from "react"
import { useMutation, useQueryClient, type UseQueryResult } from "@tanstack/react-query"
import {
  RiAlertLine,
  RiArrowDownSLine,
  RiArrowRightSLine,
} from "@remixicon/react"
import { MetaConfigErrorHint } from "@/components/meta-config-error-hint"
import { Skeleton } from "@/components/ui/skeleton"
import { isMetaConfigError } from "@/lib/services/meta/meta-errors"
import { informeCpaTone } from "@/lib/services/meta/meta-informe-rules"
import { cn } from "@/lib/utils"
import { runServerAction } from "@/lib/server-action"
import type { MetaInformePayload } from "@/lib/services/meta/meta-operative-service"
import {
  setInformeAdsetStatusAction,
  setInformeCpaTargetAction,
  syncMetaInformeAction,
} from "../_actions/meta-informe"
import { InformeActions } from "./informe-actions"
import { InformeCpaTarget } from "./informe-cpa-target"
import { moneyFormatter, TONE_TEXT } from "./informe-format"
import { InformeKpis } from "./informe-kpis"
import { InformeMatrix } from "./informe-matrix"
import { InformeSide } from "./informe-side"

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}

/** Resumen de hoy en la cabecera: se ve con la cuenta plegada. */
function TodaySummary({ data }: { data: MetaInformePayload }) {
  const money = moneyFormatter(data.account.currency)
  const spend = data.accountSpendToday
  const purchases = data.accountPurchasesToday
  const cpa = purchases > 0 ? spend / purchases : 0
  return (
    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm tabular-nums">
      <span>
        <span className="text-muted-foreground text-xs">Gasto hoy </span>
        <span className="font-semibold">{money(spend)}</span>
      </span>
      <span>
        <span className="text-muted-foreground text-xs">Compras </span>
        <span className="font-semibold">{purchases}</span>
      </span>
      <span>
        <span className="text-muted-foreground text-xs">CPA </span>
        <span
          className={cn(
            "font-semibold",
            TONE_TEXT[informeCpaTone(cpa, data.cpaTarget)]
          )}
        >
          {cpa > 0 ? money(cpa) : "—"}
        </span>
      </span>
    </div>
  )
}

export function informeQueryKey(accountId: string) {
  return ["meta-informe-ia", accountId] as const
}

export function InformeAccountSection({
  accountId,
  accountName,
  query,
}: {
  accountId: string
  accountName: string
  query: UseQueryResult<MetaInformePayload | undefined>
}) {
  const queryClient = useQueryClient()
  const [collapsed, setCollapsed] = useState(true)
  const queryKey = informeQueryKey(accountId)
  const data = query.data

  const syncMutation = useMutation({
    mutationFn: () => runServerAction(syncMetaInformeAction(accountId)),
    onSuccess: (next) => queryClient.setQueryData(queryKey, next),
  })

  const targetMutation = useMutation({
    mutationFn: (cpaTarget: number) =>
      runServerAction(setInformeCpaTargetAction({ accountId, cpaTarget })),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({
          queryKey: ["meta-informe-adset-ads", accountId],
        }),
      ]),
  })

  const statusMutation = useMutation({
    mutationFn: (input: { adsetId: string; status: "ACTIVE" | "PAUSED" }) =>
      runServerAction(setInformeAdsetStatusAction({ accountId, ...input })),
    onSuccess: () => syncMutation.mutate(),
  })

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-2xl border p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          className="flex items-center gap-1.5 text-left"
        >
          {collapsed ? (
            <RiArrowRightSLine className="size-5" />
          ) : (
            <RiArrowDownSLine className="size-5" />
          )}
          <h2 className="text-lg font-semibold tracking-tight">
            {data?.account.name ?? accountName}
          </h2>
          {data ? (
            <span className="text-muted-foreground text-xs">
              {data.account.currency === "PEN" ? "Soles" : data.account.currency}
            </span>
          ) : null}
          {syncMutation.isPending || query.isFetching ? (
            <span className="text-muted-foreground text-xs">· actualizando…</span>
          ) : null}
        </button>
        {data ? <TodaySummary data={data} /> : null}
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
      </div>

      {collapsed ? null : query.isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : query.isError ? (
        <div className="border-destructive/30 bg-destructive/5 rounded-lg border px-4 py-3 text-sm">
          <p className="text-destructive font-medium">
            {isMetaConfigError(query.error)
              ? "Meta no está configurado en este entorno."
              : "No se pudo cargar el informe de esta cuenta."}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {errorText(query.error, "Revisa Meta y la base de datos.")}
          </p>
          {isMetaConfigError(query.error) ? <MetaConfigErrorHint /> : null}
        </div>
      ) : data ? (
        <>
          {data.account.statusLabel ? (
            <div className="flex gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm">
              <RiAlertLine className="mt-0.5 size-4 shrink-0 text-red-600" />
              <p>
                <span className="font-medium">{data.account.statusLabel}.</span>{" "}
                <span className="text-muted-foreground">
                  Meta no entrega gasto de esta cuenta.
                </span>
              </p>
            </div>
          ) : null}

          <InformeKpis data={data} />

          {data.groups.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm">
              Sin gasto en los últimos {data.dateKeys.length} días.
            </p>
          ) : (
            <>
              <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <div className="flex min-w-0 flex-col gap-2">
                  <h3 className="text-sm font-semibold">
                    Qué hacer ahora
                    {data.actions.length > 0 ? ` · ${data.actions.length}` : ""}
                  </h3>
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

              <div className="flex min-w-0 flex-col gap-2">
                <h3 className="text-sm font-semibold">
                  Campañas, conjuntos y anuncios · {data.groups.length} campaña
                  {data.groups.length === 1 ? "" : "s"}
                </h3>
                <InformeMatrix data={data} />
              </div>
            </>
          )}
        </>
      ) : null}
    </section>
  )
}
