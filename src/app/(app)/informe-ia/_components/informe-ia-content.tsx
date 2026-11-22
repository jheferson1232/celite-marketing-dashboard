"use client"

import { useMemo, useState } from "react"
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { RiEyeLine, RiRefreshLine, RiSendPlaneLine } from "@remixicon/react"
import { listMetaAdAccountsAction } from "@/app/(app)/dashboard/_actions/meta-ad-accounts"
import { MetaApiStatusIndicator } from "@/components/meta-api-status-indicator"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { getMetaInformeApiStatus } from "@/lib/meta-api-status"
import { runServerAction } from "@/lib/server-action"
import type { MetaAdAccountSummary } from "@/lib/services/meta/meta-ad-accounts"
import {
  getMetaInformeAction,
  previewMetaInformeHourlyAction,
  sendMetaInformeHourlyToTelegramAction,
  syncMetaInformeAction,
} from "../_actions/meta-informe"
import {
  InformeAccountSection,
  informeQueryKey,
} from "./informe-account-section"

const STORAGE_KEY = "informe-ia-accounts:v1"
/** Cuentas que abre el informe si no hay selección guardada: Mokado Katy y Mokado CP. */
const DEFAULT_ACCOUNT_IDS = ["870267208104445", "428704200222227"]

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}

function readStoredSelection(): string[] | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : null
  } catch {
    return null
  }
}

function defaultSelection(accounts: MetaAdAccountSummary[]): string[] {
  const defaults = DEFAULT_ACCOUNT_IDS.filter((id) =>
    accounts.some((a) => a.accountId === id)
  )
  if (defaults.length > 0) return defaults
  const firstActive = accounts.find((a) => !a.statusLabel) ?? accounts[0]
  return firstActive ? [firstActive.accountId] : []
}

export function InformeIaContent() {
  const queryClient = useQueryClient()
  const [chosen, setChosen] = useState<string[] | null>(null)
  const [telegramText, setTelegramText] = useState<string | null>(null)
  const [telegramSent, setTelegramSent] = useState<number | null>(null)

  const accountsQuery = useQuery({
    queryKey: ["meta-ad-accounts"],
    queryFn: () => runServerAction(listMetaAdAccountsAction()),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data])

  // Las cuentas llegan solo en el cliente, así que leer localStorage aquí no
  // genera diferencias de hidratación.
  const selectedIds = useMemo(() => {
    if (accounts.length === 0) return []
    const base = chosen ?? readStoredSelection() ?? defaultSelection(accounts)
    const valid = accounts
      .map((a) => a.accountId)
      .filter((id) => base.includes(id))
    return valid.length > 0 ? valid : defaultSelection(accounts)
  }, [accounts, chosen])

  const toggleAccount = (accountId: string) => {
    const next = selectedIds.includes(accountId)
      ? selectedIds.filter((id) => id !== accountId)
      : [...selectedIds, accountId]
    if (next.length === 0) return
    setChosen(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // ignore
    }
  }

  const informeQueries = useQueries({
    queries: selectedIds.map((accountId) => ({
      queryKey: informeQueryKey(accountId),
      queryFn: () => runServerAction(getMetaInformeAction(accountId)),
      staleTime: 2 * 60 * 1000,
    })),
  })

  const syncAllMutation = useMutation({
    mutationFn: () =>
      Promise.all(
        selectedIds.map(async (accountId) => {
          const data = await runServerAction(syncMetaInformeAction(accountId))
          queryClient.setQueryData(informeQueryKey(accountId), data)
        })
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["meta-informe-adset-ads"] }),
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

  const telegramPending = previewMutation.isPending || sendMutation.isPending
  const telegramError = previewMutation.error ?? sendMutation.error

  const firstError =
    (informeQueries.find((q) => q.isError)?.error as Error | undefined) ??
    (syncAllMutation.error as Error | null) ??
    null
  const metaApiStatus = getMetaInformeApiStatus({
    informe: {
      isLoading: informeQueries.some((q) => q.isLoading),
      isFetching: informeQueries.some((q) => q.isFetching),
      isError: Boolean(firstError),
      isSuccess:
        informeQueries.length > 0 &&
        informeQueries.every((q) => q.isSuccess) &&
        !syncAllMutation.isError,
      error: firstError,
    },
    isSyncing: syncAllMutation.isPending,
    hourlyError: telegramError ? errorText(telegramError, "") : null,
  })

  return (
    <div className="mx-auto flex w-full max-w-[1400px] min-w-0 flex-col gap-4 p-4 pb-10 sm:p-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Informe IA</h1>
          <MetaApiStatusIndicator status={metaApiStatus} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncAllMutation.mutate()}
            disabled={syncAllMutation.isPending || selectedIds.length === 0}
          >
            <RiRefreshLine
              className={syncAllMutation.isPending ? "size-4 animate-spin" : "size-4"}
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
          <Button size="sm" onClick={() => sendMutation.mutate()} disabled={telegramPending}>
            <RiSendPlaneLine className="size-4" />
            {sendMutation.isPending ? "Enviando…" : "Enviar a Telegram"}
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-xs">Cuentas:</span>
        {accountsQuery.isLoading ? (
          <Skeleton className="h-7 w-64" />
        ) : (
          accounts.map((account) => {
            const active = selectedIds.includes(account.accountId)
            return (
              <button
                key={account.accountId}
                type="button"
                aria-pressed={active}
                onClick={() => toggleAccount(account.accountId)}
                className={cn(
                  "focus-visible:ring-ring/50 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium outline-none focus-visible:ring-3",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {account.name}
                {account.statusLabel ? (
                  <span className={active ? "opacity-70" : "text-red-600 dark:text-red-400"}>
                    · {account.statusLabel}
                  </span>
                ) : null}
              </button>
            )
          })
        )}
        <span className="text-muted-foreground text-xs">
          · Telegram 8:00 y 20:00 (Lima) incluye todas las cuentas.
        </span>
      </div>

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
      {syncAllMutation.isError ? (
        <p className="text-destructive text-sm">
          {errorText(syncAllMutation.error, "No se pudo sincronizar.")}
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

      {selectedIds.map((accountId, index) => (
        <InformeAccountSection
          key={accountId}
          accountId={accountId}
          accountName={
            accounts.find((a) => a.accountId === accountId)?.name ?? accountId
          }
          query={informeQueries[index]!}
        />
      ))}
    </div>
  )
}
