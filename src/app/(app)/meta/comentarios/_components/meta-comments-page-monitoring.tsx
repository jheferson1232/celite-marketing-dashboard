"use client"

import { RiFacebookFill, RiSubtractLine } from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { MetaCommentPageMonitoringState } from "@/lib/services/meta/comments/types"

type PageRowProps = {
  pageId: string
  pageName: string
  action: "add" | "remove"
  onAction: () => void
  disabled?: boolean
}

function PageRow({ pageName, action, onAction, disabled }: PageRowProps) {
  return (
    <button
      type="button"
      onClick={onAction}
      disabled={disabled}
      className="hover:bg-muted/60 flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors disabled:opacity-50"
    >
      <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
        <RiFacebookFill className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{pageName}</p>
        <p className="text-muted-foreground text-xs">Facebook</p>
      </div>
      <div className="text-muted-foreground flex size-8 items-center justify-center rounded-full border">
        {action === "add" ? "+" : <RiSubtractLine className="size-4" />}
      </div>
    </button>
  )
}

export function MetaCommentsPageMonitoring({
  state,
  loading,
  onTogglePage,
  onAddAll,
  onRemoveAll,
  busy,
}: {
  state: MetaCommentPageMonitoringState | undefined
  loading: boolean
  onTogglePage: (pageId: string, enabled: boolean) => void
  onAddAll: () => void
  onRemoveAll: () => void
  busy: boolean
}) {
  if (loading) {
    return <Skeleton className="h-80 rounded-2xl" />
  }

  const available = state?.available ?? []
  const monitored = state?.monitored ?? []

  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      <div className="border-b px-5 py-4">
        <h2 className="font-semibold">Páginas a monitorear</h2>
        <p className="text-muted-foreground text-sm">
          Elegí qué páginas de Facebook revisa el agente en cada corrida
        </p>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-2">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Disponibles</p>
            <p className="text-muted-foreground text-xs">
              Clic para agregar al monitoreo
            </p>
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {available.length ? (
              available.map((page) => (
                <PageRow
                  key={page.pageId}
                  pageId={page.pageId}
                  pageName={page.pageName}
                  action="add"
                  disabled={busy}
                  onAction={() => onTogglePage(page.pageId, true)}
                />
              ))
            ) : (
              <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-8 text-center text-sm">
                Todas las páginas están en monitoreo
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={busy || available.length === 0}
            onClick={onAddAll}
          >
            Agregar todas ({available.length})
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">En monitoreo</p>
            <p className="text-muted-foreground text-xs">
              Clic para quitar del monitoreo
            </p>
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {monitored.length ? (
              monitored.map((page) => (
                <PageRow
                  key={page.pageId}
                  pageId={page.pageId}
                  pageName={page.pageName}
                  action="remove"
                  disabled={busy}
                  onAction={() => onTogglePage(page.pageId, false)}
                />
              ))
            ) : (
              <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-8 text-center text-sm">
                No hay páginas en monitoreo. Agregá al menos una.
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={busy || monitored.length === 0}
            onClick={onRemoveAll}
          >
            Quitar todas ({monitored.length})
          </Button>
        </div>
      </div>

      <div className="border-t px-5 py-3">
        <p className="text-emerald-600 text-sm dark:text-emerald-400">
          Monitoreando {monitored.length} página(s)
        </p>
      </div>
    </div>
  )
}
