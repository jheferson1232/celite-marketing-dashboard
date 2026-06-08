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

      <div className="flex flex-col items-center gap-4 py-2">
        <Button
          asChild
          size="lg"
          className="h-12 w-full max-w-md bg-[#1877F2] px-8 text-base font-semibold text-white shadow-md shadow-blue-500/25 hover:bg-[#166FE5]"
        >
          <a href="/api/meta/oauth/start">
            Connect Facebook &amp; Instagram
          </a>
        </Button>

        {!hasPages ? (
          <p className="text-muted-foreground max-w-md text-center text-sm">
            Autorizá el acceso a tus páginas para que el agente pueda leer y
            responder comentarios.
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
