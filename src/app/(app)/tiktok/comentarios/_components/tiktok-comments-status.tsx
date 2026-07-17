"use client"

import Link from "next/link"
import { RiShieldCheckLine } from "@remixicon/react"
import { Skeleton } from "@/components/ui/skeleton"
import type { TikTokCommentAgentStatus } from "@/lib/services/tiktok/comments/types"

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

export function TikTokCommentsStatus({
  status,
  loading,
}: {
  status: TikTokCommentAgentStatus | undefined
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
              label="TikTok Ads"
              ok={status.tiktokConfigured}
              neutral={!status.tiktokConfigured}
              detail={
                status.tiktokConfigured
                  ? `Cuenta ${status.advertiserName ?? status.advertiserId}`
                  : "Conectá en Cuentas TikTok Ads"
              }
            />
          </div>

          {status.tiktokConfigured && status.advertiserId ? (
            <p className="text-muted-foreground text-xs">
              Advertiser ID: {status.advertiserId}
            </p>
          ) : null}

          {status.missing.length > 0 ? (
            <p className="text-destructive text-xs">
              Falta configurar: {status.missing.join(", ")}
            </p>
          ) : status.anthropicConfigured && status.tiktokConfigured ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              Listo para ejecutar el agente.
            </p>
          ) : null}

          <p className="text-muted-foreground text-xs">
            Prompts y catálogo de productos se comparten con{" "}
            <Link
              href="/meta/comentarios/configuracion"
              className="text-foreground underline-offset-4 hover:underline"
            >
              Comentarios IA (Meta)
            </Link>
            .
          </p>
        </div>
      ) : null}
    </div>
  )
}
