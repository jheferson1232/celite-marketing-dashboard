"use client"

import { RiShieldCheckLine } from "@remixicon/react"
import { Skeleton } from "@/components/ui/skeleton"
import type { MetaCommentAgentStatus } from "@/lib/services/meta/comments/types"

function StatusPill({
  label,
  ok,
  detail,
  neutral,
}: {
  label: string
  ok: boolean
  detail: string
  neutral?: boolean
}) {
  const className = ok
    ? "rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3"
    : neutral
      ? "rounded-xl border border-border bg-muted/40 px-4 py-3"
      : "rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3"

  return (
    <div className={className}>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-muted-foreground text-xs">{detail}</p>
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
          <div className="grid gap-3 sm:grid-cols-2">
            <StatusPill
              label="Anthropic Claude"
              ok={status.anthropicConfigured}
              detail={
                status.anthropicConfigured
                  ? "Modelo de IA conectado"
                  : "Falta ANTHROPIC_API_KEY"
              }
            />
            <StatusPill
              label="Facebook & Instagram"
              ok={status.oauthConnected}
              neutral={!status.oauthConnected}
              detail={
                status.oauthConnected
                  ? `${status.oauthPageCount} página${status.oauthPageCount !== 1 ? "s" : ""} conectada${status.oauthPageCount !== 1 ? "s" : ""}`
                  : "Conectá usando el botón de abajo"
              }
            />
          </div>

          {status.oauthConnected && status.pageCount > 0 ? (
            <p className="text-muted-foreground text-xs">
              Páginas: {status.pageNames.join(", ")} · Monitoreando{" "}
              {status.monitoredCount}
            </p>
          ) : null}

          {status.missing.length > 0 ? (
            <p className="text-destructive text-xs">
              Falta configurar: {status.missing.join(", ")}
            </p>
          ) : status.anthropicConfigured ? (
            <p
              className={
                status.oauthConnected
                  ? "text-xs text-emerald-600 dark:text-emerald-400"
                  : "text-xs text-muted-foreground"
              }
            >
              {status.oauthConnected
                ? "Listo para ejecutar el agente."
                : "Conectá tus páginas de Facebook para activar el agente."}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
