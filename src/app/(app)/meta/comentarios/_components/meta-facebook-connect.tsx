"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiFacebookBoxFill,
} from "@remixicon/react"
import { runServerAction } from "@/lib/server-action"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  disconnectFacebookPageAction,
  getMetaOAuthStatusAction,
  listConnectedFacebookPagesAction,
} from "../_actions/meta-facebook-connect"

type PageRow = {
  id: string
  pageId: string
  pageName: string
  pageCategory: string | null
  connected: boolean
  updatedAt: string
}

export function MetaFacebookConnect({
  onConnectionChange,
}: {
  onConnectionChange?: () => void
}) {
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const oauthResult = searchParams.get("oauth")
  const oauthError = searchParams.get("oauth_error")
  const oauthCount = searchParams.get("count")

  const pagesQuery = useQuery({
    queryKey: ["meta-facebook-connections"],
    queryFn: () => runServerAction(listConnectedFacebookPagesAction()),
  })

  const oauthStatusQuery = useQuery({
    queryKey: ["meta-oauth-status"],
    queryFn: () => runServerAction(getMetaOAuthStatusAction()),
  })

  const oauthReady = oauthStatusQuery.data?.configured ?? false
  const businessLoginConfigured =
    oauthStatusQuery.data?.businessLoginConfigured ?? false
  const redirectUri = oauthStatusQuery.data?.redirectUri

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["meta-facebook-connections"],
    })
    await queryClient.invalidateQueries({
      queryKey: ["meta-comment-agent-status"],
    })
    await queryClient.invalidateQueries({
      queryKey: ["meta-comment-page-configs"],
    })
    onConnectionChange?.()
  }

  const disconnectMutation = useMutation({
    mutationFn: (pageId: string) =>
      runServerAction(disconnectFacebookPageAction(pageId)),
    onSuccess: invalidate,
  })

  useEffect(() => {
    if (oauthResult || oauthError) {
      const url = new URL(window.location.href)
      url.searchParams.delete("oauth")
      url.searchParams.delete("oauth_error")
      url.searchParams.delete("count")
      window.history.replaceState({}, "", url.toString())
      void invalidate()
    }
  }, [oauthResult, oauthError])

  const pages = pagesQuery.data ?? []
  const hasPages = pages.length > 0

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-5 flex items-center gap-2">
        <RiFacebookBoxFill className="size-5 text-blue-600" />
        <h2 className="font-semibold">Facebook & Instagram</h2>
      </div>

      {oauthResult === "success" && oauthCount ? (
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          {oauthCount} página{Number(oauthCount) !== 1 ? "s" : ""} conectada
          {Number(oauthCount) !== 1 ? "s" : ""} correctamente.
        </div>
      ) : null}

      {oauthError ? (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {oauthError}
        </div>
      ) : null}

      {!oauthStatusQuery.isLoading && !oauthReady ? (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          <p className="font-medium">OAuth de Facebook no configurado en el servidor</p>
          <p className="mt-1 text-xs opacity-90">
            Agregá <code className="text-xs">META_APP_ID</code> y{" "}
            <code className="text-xs">META_APP_SECRET</code> en tu{" "}
            <code className="text-xs">.env</code> local (y reiniciá{" "}
            <code className="text-xs">pnpm dev</code>) o en Vercel para producción.
            Son distintos del token de Meta Ads (
            <code className="text-xs">META_ACCESS_TOKEN</code>).
          </p>
          {redirectUri ? (
            <p className="mt-2 text-xs opacity-90">
              En Meta for Developers → tu app → Facebook Login → Valid OAuth Redirect
              URIs, agregá:{" "}
              <code className="break-all text-xs">{redirectUri}</code>
            </p>
          ) : null}
        </div>
      ) : null}

      {!oauthStatusQuery.isLoading && oauthReady && !businessLoginConfigured ? (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          <p className="font-medium">
            Si Facebook muestra «Función no disponible»
          </p>
          <p className="mt-1 text-xs opacity-90">
            Las apps Business nuevas requieren{" "}
            <strong>Facebook Login for Business</strong>. En Meta for Developers →
            tu app → <strong>Facebook Login for Business → Configurations</strong>{" "}
            → Create configuration con permisos de páginas. Copiá el{" "}
            <code className="text-xs">config_id</code> y agregalo como{" "}
            <code className="text-xs">META_OAUTH_CONFIG_ID</code> en{" "}
            <code className="text-xs">.env</code> o Vercel. También agregá tu usuario
            en <strong>App roles</strong> si la app está en Development.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col items-center gap-4 py-2">
        {oauthReady ? (
          <Button
            asChild
            size="lg"
            className="h-12 w-full max-w-md bg-[#1877F2] px-8 text-base font-semibold text-white shadow-md shadow-blue-500/25 hover:bg-[#166FE5]"
          >
            <a href="/api/meta/oauth/start">
              Connect Facebook &amp; Instagram
            </a>
          </Button>
        ) : (
          <Button
            size="lg"
            disabled
            className="h-12 w-full max-w-md bg-[#1877F2]/50 px-8 text-base font-semibold text-white"
          >
            Connect Facebook &amp; Instagram
          </Button>
        )}

        {!hasPages ? (
          <p className="text-muted-foreground max-w-md text-center text-sm">
            {oauthReady
              ? "Autorizá el acceso a tus páginas para que el agente pueda leer y responder comentarios."
              : "El botón se habilita cuando META_APP_ID y META_APP_SECRET estén configurados."}
          </p>
        ) : null}
      </div>

      {pagesQuery.isLoading ? (
        <Skeleton className="mt-4 h-20 w-full" />
      ) : hasPages ? (
        <div className="mt-4 divide-y rounded-xl border">
          {pages.map((page) => (
            <ConnectedPageRow
              key={page.pageId}
              page={page}
              onDisconnect={() => disconnectMutation.mutate(page.pageId)}
              busy={disconnectMutation.isPending}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ConnectedPageRow({
  page,
  onDisconnect,
  busy,
}: {
  page: PageRow
  onDisconnect: () => void
  busy: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <RiCheckboxCircleLine className="size-4 shrink-0 text-emerald-500" />
          <p className="truncate text-sm font-medium">{page.pageName}</p>
        </div>
        {page.pageCategory ? (
          <p className="text-muted-foreground ml-6 text-xs">{page.pageCategory}</p>
        ) : null}
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 shrink-0 text-xs text-destructive hover:text-destructive"
        onClick={onDisconnect}
        disabled={busy}
      >
        <RiCloseCircleLine className="size-3.5" />
        Desconectar
      </Button>
    </div>
  )
}
