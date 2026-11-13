"use client"

import type { ReactNode } from "react"
import { RiChat3Line, RiExternalLinkLine, RiRefreshLine } from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type {
  TikTokCommentDashboardMetrics,
  TikTokCommentDecisionRecord,
  TikTokLiveComment,
} from "@/lib/services/tiktok/comments/types"
import {
  CLASSIFICATION_LABEL,
  formatLimaTime,
  formatRelative,
  tikTokPostUrl,
} from "./tiktok-comments-format"

export type TikTokFeedFilter =
  | "all"
  | "new"
  | "replies"
  | "hidden"
  | "skipped"
  | "errors"

type RowKind = "new" | "reply" | "hide" | "skip" | "error"

const KIND_STYLE: Record<RowKind, { label: string; stripe: string; pill: string }> = {
  new: {
    label: "Nuevo",
    stripe: "bg-rose-500",
    pill: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  reply: {
    label: "Respondido",
    stripe: "bg-emerald-500",
    pill: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  hide: {
    label: "Oculto",
    stripe: "bg-red-500",
    pill: "bg-red-500/10 text-red-600 dark:text-red-400",
  },
  skip: {
    label: "Sin acción",
    stripe: "bg-border",
    pill: "bg-muted text-muted-foreground",
  },
  error: {
    label: "Error",
    stripe: "bg-amber-500",
    pill: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
}

function decisionKind(row: TikTokCommentDecisionRecord): RowKind {
  if (row.errorMessage) return "error"
  if (row.action === "reply" && row.applied) return "reply"
  if (row.action === "hide" && row.applied) return "hide"
  return "skip"
}

function FeedRow({
  kind,
  author,
  when,
  context,
  message,
  detail,
  actions,
}: {
  kind: RowKind
  author: string
  when: string
  context: string | null
  message: string
  detail: ReactNode
  actions: ReactNode
}) {
  const style = KIND_STYLE[kind]
  return (
    <div className="grid grid-cols-[4px_1fr] gap-x-3 border-b py-3 pr-3 last:border-b-0 md:grid-cols-[4px_96px_minmax(0,1fr)_minmax(0,1.1fr)_auto] md:items-start md:gap-x-4">
      <span
        aria-hidden
        className={cn("row-span-4 self-stretch rounded-r-sm md:row-span-1", style.stripe)}
      />
      <span
        className={cn(
          "w-fit rounded-md px-2 py-1 text-[11px] leading-none font-semibold",
          style.pill
        )}
      >
        {style.label}
      </span>
      <div className="mt-2 min-w-0 md:mt-0">
        <p className="text-sm">
          <span className="font-medium">{author}</span>{" "}
          <span className="text-muted-foreground text-xs">
            · {when}
            {context ? ` · ${context}` : ""}
          </span>
        </p>
        <p
          className={cn(
            "text-sm break-words",
            kind === "hide" && "text-muted-foreground"
          )}
        >
          {message}
        </p>
      </div>
      <div className="mt-2 min-w-0 text-sm md:mt-0">{detail}</div>
      <div className="mt-2 flex flex-wrap gap-1 md:mt-0 md:justify-end">
        {actions}
      </div>
    </div>
  )
}

function PostLink({ href }: { href: string | null }) {
  if (!href) return null
  return (
    <Button variant="ghost" size="sm" asChild>
      <a href={href} target="_blank" rel="noopener noreferrer">
        Post
        <RiExternalLinkLine className="size-3.5" />
      </a>
    </Button>
  )
}

function DecisionRow({
  row,
  onRetry,
  retrying,
}: {
  row: TikTokCommentDecisionRecord
  onRetry: (id: string) => void
  retrying: boolean
}) {
  const kind = decisionKind(row)
  const label = CLASSIFICATION_LABEL[row.classification] ?? row.classification

  const detail =
    kind === "error" ? (
      <p className="text-amber-700 dark:text-amber-400">{row.errorMessage}</p>
    ) : row.action === "reply" && row.replyText ? (
      <p className="bg-muted rounded-md px-2.5 py-1.5">{row.replyText}</p>
    ) : (
      <p className="text-muted-foreground">{label}</p>
    )

  const canRetry =
    kind === "error" &&
    !row.applied &&
    (row.action === "reply" || row.action === "hide")

  return (
    <FeedRow
      kind={kind}
      author={row.authorName ?? "Usuario de TikTok"}
      when={formatLimaTime(row.createdAt)}
      context={label}
      message={row.message}
      detail={detail}
      actions={
        <>
          {canRetry ? (
            <Button
              variant="outline"
              size="sm"
              disabled={retrying}
              onClick={() => onRetry(row.id)}
            >
              <RiRefreshLine className="size-3.5" />
              {retrying ? "Reintentando…" : "Reintentar"}
            </Button>
          ) : null}
          <PostLink href={tikTokPostUrl(null, row.tiktokItemId)} />
        </>
      }
    />
  )
}

function NewRow({ row }: { row: TikTokLiveComment }) {
  return (
    <FeedRow
      kind="new"
      author={row.authorName ?? "Usuario de TikTok"}
      when={formatRelative(row.createdTime)}
      context={[row.adName, row.accountName].filter(Boolean).join(" · ") || null}
      message={row.message}
      detail={
        <p className="text-muted-foreground">
          Se procesa en la próxima corrida («Ejecutar ahora»).
        </p>
      }
      actions={
        <PostLink href={tikTokPostUrl(row.profileName, row.tiktokItemId)} />
      }
    />
  )
}

function Chip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean
  label: string
  count: number | undefined
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "focus-visible:ring-ring/50 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3",
        active
          ? "border-foreground text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
      {count != null ? (
        <span className="font-mono tabular-nums">{count}</span>
      ) : null}
    </button>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="bg-muted flex size-14 items-center justify-center rounded-full">
        <RiChat3Line className="text-muted-foreground size-6" />
      </div>
      <p className="mt-4 font-medium">{title}</p>
      <p className="text-muted-foreground mt-1 max-w-md text-sm">{body}</p>
    </div>
  )
}

export function TikTokCommentsFeed({
  filter,
  onFilterChange,
  metrics,
  decisions,
  decisionsLoading,
  newComments,
  newLoading,
  liveError,
  liveFetchErrors,
  onRetry,
  retryingId,
}: {
  filter: TikTokFeedFilter
  onFilterChange: (filter: TikTokFeedFilter) => void
  metrics: TikTokCommentDashboardMetrics | undefined
  decisions: TikTokCommentDecisionRecord[] | undefined
  decisionsLoading: boolean
  newComments: TikTokLiveComment[] | undefined
  newLoading: boolean
  liveError: string | null
  liveFetchErrors: string[]
  onRetry: (id: string) => void
  retryingId: string | null
}) {
  const chips: Array<{ id: TikTokFeedFilter; label: string; count?: number }> = [
    {
      id: "all",
      label: "Todos",
      count:
        metrics && newComments
          ? metrics.processed + newComments.length
          : undefined,
    },
    { id: "new", label: "Nuevos en TikTok", count: newComments?.length },
    { id: "replies", label: "Respondidos", count: metrics?.replied },
    { id: "hidden", label: "Ocultos", count: metrics?.hidden },
    { id: "skipped", label: "Sin acción", count: metrics?.skipped },
    { id: "errors", label: "Errores", count: metrics?.errors },
  ]

  const showNew = filter === "all" || filter === "new"
  const showDecisions = filter !== "new"
  const loading =
    (showDecisions && decisionsLoading) || (filter === "new" && newLoading)
  const newRows = showNew ? (newComments ?? []) : []
  const decisionRows = showDecisions ? (decisions ?? []) : []

  return (
    <div className="bg-card overflow-hidden rounded-xl border">
      <div className="flex flex-wrap items-center gap-1.5 border-b px-3 py-2.5">
        {chips.map((chip) => (
          <Chip
            key={chip.id}
            active={filter === chip.id}
            label={chip.label}
            count={chip.count}
            onClick={() => onFilterChange(chip.id)}
          />
        ))}
      </div>

      {showNew && liveError ? (
        <p className="text-destructive border-b px-4 py-2 text-xs">
          No se pudieron leer los comentarios en vivo: {liveError}
        </p>
      ) : null}

      {loading ? (
        <div className="space-y-3 p-4">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : newRows.length + decisionRows.length > 0 ? (
        <div>
          {newRows.map((row) => (
            <NewRow key={`new-${row.id}`} row={row} />
          ))}
          {decisionRows.map((row) => (
            <DecisionRow
              key={row.id}
              row={row}
              onRetry={onRetry}
              retrying={retryingId === row.id}
            />
          ))}
        </div>
      ) : filter === "new" ? (
        <EmptyState
          title="No hay comentarios nuevos en TikTok"
          body="Todos los comentarios de los ads Spark de los últimos 7 días ya fueron procesados. Si los conjuntos tenían comentarios desactivados, usá «Habilitar comentarios Spark»."
        />
      ) : (
        <EmptyState
          title="Sin comentarios en este período"
          body="Pulsá «Ejecutar ahora» para que la IA procese los comentarios nuevos de los ads Spark."
        />
      )}

      {showNew && liveFetchErrors.length > 0 ? (
        <div className="border-t px-4 py-2.5">
          {liveFetchErrors.slice(0, 3).map((error) => (
            <p key={error} className="text-destructive text-xs">
              {error}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  )
}
