"use client"

import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { useRouter, useSearchParams } from "next/navigation"
import { runServerAction } from "@/lib/server-action"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  RiLinksLine,
  RiRefreshLine,
  RiStarFill,
  RiStarLine,
} from "@remixicon/react"
import {
  connectTikTokAdAccountAction,
  disconnectTikTokAdAccountAction,
  getTikTokAdAccountsHealthAction,
  getTikTokEnvAccountSummaryAction,
  getTikTokOAuthStatusAction,
  importTikTokEnvAccountAction,
  listTikTokAdAccountsAction,
  refreshAllTikTokAdAccountsAction,
  setDefaultTikTokAdAccountForTestsAction,
} from "../_actions/tiktok-ad-accounts"
import { ConnectTikTokAccountButton } from "./connect-tiktok-account-button"
import { ConnectTikTokAccountDialog } from "./connect-tiktok-account-dialog"
import { TikTokAccountHealthMetrics } from "./tiktok-account-health-metrics"
import { TikTokAdvertiserStatusBadge } from "./tiktok-advertiser-status-badge"

const ACCOUNTS_QUERY_KEY = ["tiktok-ad-accounts"] as const
const ACCOUNTS_HEALTH_QUERY_KEY = ["tiktok-ad-accounts-health"] as const

function invalidateAccounts(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY })
  void queryClient.invalidateQueries({ queryKey: ACCOUNTS_HEALTH_QUERY_KEY })
  void queryClient.invalidateQueries({ queryKey: ["tiktok-env-account"] })
  void queryClient.invalidateQueries({ queryKey: ["tiktok-account-kpis"] })
  void queryClient.invalidateQueries({ queryKey: ["tiktok-campaigns-list"] })
}

function formatConnectedRelative(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: false, locale: es })
}

export function TikTokCuentasContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [feedback, setFeedback] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  useEffect(() => {
    const oauth = searchParams.get("oauth")
    const oauthError = searchParams.get("oauth_error")
    const count = searchParams.get("count")

    if (oauth === "success") {
      setFeedback({
        type: "success",
        message:
          count && Number(count) > 1
            ? `${count} cuentas conectadas vía TikTok OAuth.`
            : "Cuenta conectada vía TikTok OAuth.",
      })
      invalidateAccounts(queryClient)
    } else if (oauthError) {
      setFeedback({ type: "error", message: oauthError })
    }

    if (oauth || oauthError) {
      router.replace("/tiktok/cuentas", { scroll: false })
    }
  }, [searchParams, router, queryClient])

  const oauthStatusQuery = useQuery({
    queryKey: ["tiktok-oauth-status"],
    queryFn: () => runServerAction(getTikTokOAuthStatusAction()),
  })

  const accountsQuery = useQuery({
    queryKey: ACCOUNTS_QUERY_KEY,
    queryFn: () => runServerAction(listTikTokAdAccountsAction()),
  })

  const accountsHealthQuery = useQuery({
    queryKey: ACCOUNTS_HEALTH_QUERY_KEY,
    queryFn: () => runServerAction(getTikTokAdAccountsHealthAction()),
    enabled: (accountsQuery.data?.length ?? 0) > 0,
    staleTime: 2 * 60 * 1000,
  })

  const envQuery = useQuery({
    queryKey: ["tiktok-env-account"],
    queryFn: () => runServerAction(getTikTokEnvAccountSummaryAction()),
  })

  const invalidate = () => invalidateAccounts(queryClient)

  const connectMutation = useMutation({
    mutationFn: (input: {
      advertiserId: string
      accessToken: string
      name?: string
      identityId?: string
      setAsDefault: boolean
    }) => runServerAction(connectTikTokAdAccountAction(input)),
    onSuccess: (account) => {
      setFeedback({
        type: "success",
        message: `Cuenta «${account?.name ?? "nueva"}» conectada.`,
      })
      invalidate()
    },
    onError: (error) => {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Error al conectar",
      })
    },
  })

  const importEnvMutation = useMutation({
    mutationFn: () => runServerAction(importTikTokEnvAccountAction()),
    onSuccess: (account) => {
      setFeedback({
        type: "success",
        message: `Cuenta «${account?.name ?? "nueva"}» importada desde .env.`,
      })
      invalidate()
    },
    onError: (error) => {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Error al importar",
      })
    },
  })

  const testDefaultMutation = useMutation({
    mutationFn: (accountId: string) =>
      runServerAction(setDefaultTikTokAdAccountForTestsAction(accountId)),
    onSuccess: (account) => {
      setFeedback({
        type: "success",
        message: `«${account?.name ?? "Cuenta"}» es ahora la default para testeos.`,
      })
      invalidate()
    },
    onError: (error) => {
      setFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Error al marcar default testeos",
      })
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: (accountId: string) =>
      runServerAction(disconnectTikTokAdAccountAction(accountId)),
    onSuccess: () => {
      setFeedback({ type: "success", message: "Cuenta desconectada." })
      invalidate()
    },
    onError: (error) => {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Error al desconectar",
      })
    },
  })

  const refreshMutation = useMutation({
    mutationFn: () => runServerAction(refreshAllTikTokAdAccountsAction()),
    onSuccess: () => {
      invalidate()
    },
    onError: (error) => {
      setFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Error al actualizar estados",
      })
    },
  })

  const accounts = accountsQuery.data ?? []
  const healthByAccountId = new Map(
    (accountsHealthQuery.data ?? []).map((item) => [item.accountId, item])
  )
  const envAccount = envQuery.data
  const isLoading = accountsQuery.isLoading || envQuery.isLoading
  const isHealthLoading =
    accounts.length > 0 &&
    (accountsHealthQuery.isLoading || accountsHealthQuery.isFetching)
  const isBusy =
    connectMutation.isPending ||
    importEnvMutation.isPending ||
    testDefaultMutation.isPending ||
    disconnectMutation.isPending ||
    refreshMutation.isPending

  return (
    <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <RiLinksLine className="text-muted-foreground size-5" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Cuentas TikTok Ads
            </h1>
          </div>
          <p className="text-muted-foreground max-w-2xl text-sm">
            Conectá advertisers vía OAuth para que el sistema pueda automatizar
            reportes, campañas, conjuntos y audiencias.
          </p>
        </div>
        <ConnectTikTokAccountButton />
      </div>

      {oauthStatusQuery.data && !oauthStatusQuery.data.configured ? (
        <p className="text-destructive text-sm">
          OAuth no configurado: agregá TIKTOK_APP_ID y TIKTOK_APP_SECRET en .env.
          Redirect URI registrado en TikTok:{" "}
          <code className="text-xs">{oauthStatusQuery.data.redirectUri}</code>
        </p>
      ) : null}

      {feedback ? (
        <p
          className={
            feedback.type === "success"
              ? "text-sm text-emerald-600 dark:text-emerald-400"
              : "text-destructive text-sm"
          }
        >
          {feedback.message}
        </p>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base uppercase tracking-wide">
            {isLoading ? (
              <Skeleton className="h-5 w-48" />
            ) : (
              `${accounts.length} cuenta${accounts.length === 1 ? "" : "s"} conectada${accounts.length === 1 ? "" : "s"}`
            )}
          </CardTitle>
          <CardDescription>
            La cuenta default para testeos alimenta el dashboard, lanzamientos y
            agente.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {isLoading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-36 w-full rounded-lg" />
            ))
          ) : accounts.length === 0 ? (
            <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
              No hay cuentas en la base de datos. Conectá una con el botón de arriba
              o importá la configurada en .env.
            </div>
          ) : (
            accounts.map((account) => (
              <div
                key={account.id}
                className="flex flex-col gap-4 rounded-lg border p-4 lg:flex-row lg:items-start lg:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-base font-semibold">
                      {account.name}
                    </span>
                    <TikTokAdvertiserStatusBadge
                      label={account.advertiserStatusLabel}
                      kind={account.advertiserStatusKind}
                      raw={account.advertiserStatus}
                    />
                    {account.advertiserStatusKind === "suspended" ||
                    account.advertiserStatusKind === "limited" ? (
                      <span className="text-muted-foreground text-xs">
                        No podés operar campañas con esta cuenta en TikTok.
                      </span>
                    ) : null}
                    {account.isDefaultForTests ? (
                      <Badge variant="secondary" className="gap-1">
                        <RiStarFill className="size-3 text-amber-500" />
                        Default testeos
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground font-mono text-xs">
                    advertiser_id: {account.advertiserId}
                  </p>
                  <div className="grid max-w-xl grid-cols-3 gap-4 text-xs">
                    <div>
                      <p className="text-muted-foreground mb-0.5 uppercase tracking-wide">
                        Currency
                      </p>
                      <p className="font-medium">{account.currency ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-0.5 uppercase tracking-wide">
                        Timezone
                      </p>
                      <p className="font-medium">{account.timezone ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-0.5 uppercase tracking-wide">
                        País
                      </p>
                      <p className="font-medium">{account.country ?? "—"}</p>
                    </div>
                  </div>
                  <TikTokAccountHealthMetrics
                    health={healthByAccountId.get(account.id)}
                    isLoading={isHealthLoading}
                    currencyFallback={account.currency}
                  />
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">
                    Conectada hace {formatConnectedRelative(account.connectedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-stretch gap-2 sm:min-w-[180px]">
                  <Button
                    type="button"
                    variant={account.isDefaultForTests ? "secondary" : "outline"}
                    size="sm"
                    disabled={isBusy || account.isDefaultForTests}
                    onClick={() => testDefaultMutation.mutate(account.id)}
                    className="justify-start"
                  >
                    {account.isDefaultForTests ? (
                      <RiStarFill className="text-amber-500" />
                    ) : (
                      <RiStarLine className="text-amber-500" />
                    )}
                    Marcar default testeos
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => disconnectMutation.mutate(account.id)}
                    className="text-muted-foreground justify-start"
                  >
                    Desconectar
                  </Button>
                </div>
              </div>
            ))
          )}

          {envAccount && !envAccount.alreadyImported ? (
            <div className="bg-muted/40 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="font-medium">{envAccount.name}</p>
                <p className="text-muted-foreground font-mono text-xs">
                  advertiser_id: {envAccount.advertiserId}
                </p>
                <p className="text-muted-foreground text-xs">
                  Detectada en .env
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isBusy}
                onClick={() => importEnvMutation.mutate()}
              >
                Importar desde .env
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-col items-end gap-2 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => setDialogOpen(true)}
        >
          Conexión manual (token)
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isLoading || isBusy}
          onClick={() => refreshMutation.mutate()}
        >
          <RiRefreshLine className={refreshMutation.isPending ? "animate-spin" : ""} />
          Actualizar estados y métricas
        </Button>
      </div>

      <ConnectTikTokAccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        isPending={connectMutation.isPending}
        onSubmit={async (input) => {
          await connectMutation.mutateAsync(input)
        }}
      />
    </div>
  )
}
