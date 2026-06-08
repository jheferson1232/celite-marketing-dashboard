"use client"

import { RiShieldCheckLine } from "@remixicon/react"
import { Skeleton } from "@/components/ui/skeleton"
import type { MetaCommentAgentStatus } from "@/lib/services/meta/comments/types"

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
          ? "rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3"
          : "rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3"
      }
    >
      <p className="text-sm font-medium">{label}</p>
      <p className="text-muted-foreground text-xs">{ok ? "Conectado" : `Falta ${env}`}</p>
    </div>
  )
}

export function MetaCommentsStatus({
  status,
  loading,
}: {
  status: MetaCommentAgentStatus | undefined
  loading: boolean
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <RiShieldCheckLine className="size-4" />
        <h2 className="font-semibold">Estado de conexión</h2>
      </div>
      {loading ? (
        <Skeleton className="h-20 w-full" />
      ) : status ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
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
              label="Páginas Facebook"
              ok={status.pageTokenConfigured}
              env="META_PAGE_ACCESS_TOKEN"
            />
          </div>
          {status.pageCount > 0 ? (
            <p className="text-muted-foreground text-xs">
              Páginas detectadas: {status.pageNames.join(", ")} · Monitoreando{" "}
              {status.monitoredCount}
            </p>
          ) : null}
          {status.missing.length > 0 ? (
            <p className="text-destructive text-xs">
              Falta configurar: {status.missing.join(", ")}
            </p>
          ) : (
            <p className="text-emerald-600 text-xs dark:text-emerald-400">
              Listo para ejecutar el agente.
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
