"use client"

import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { RiChat3Line } from "@remixicon/react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type {
  MetaCommentActivityFilter,
  MetaCommentDecisionRecord,
} from "@/lib/services/meta/comments/types"

function actionBadge(action: string) {
  if (action === "hide") {
    return (
      <Badge variant="destructive" className="text-[10px]">
        Ocultado
      </Badge>
    )
  }
  if (action === "reply") {
    return (
      <Badge className="bg-emerald-600 text-[10px] hover:bg-emerald-600">
        Respondido
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-[10px]">
      Omitido
    </Badge>
  )
}

function ActivityRow({ row }: { row: MetaCommentDecisionRecord }) {
  const when = formatDistanceToNow(new Date(row.createdAt), {
    addSuffix: true,
    locale: es,
  })

  return (
    <div className="flex gap-3 border-b px-4 py-4 last:border-b-0">
      <div
        className={`mt-1 w-1 shrink-0 rounded-full ${
          row.action === "hide"
            ? "bg-red-500"
            : row.action === "reply"
              ? "bg-emerald-500"
              : "bg-muted-foreground/30"
        }`}
      />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {actionBadge(row.action)}
          <span className="text-muted-foreground text-xs">{when}</span>
          {row.pageName ? (
            <span className="text-muted-foreground text-xs">· {row.pageName}</span>
          ) : null}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {row.authorName ?? "Usuario de Facebook"}
          </p>
          <p className="text-sm">{row.message}</p>
        </div>
        {row.replyText ? (
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Respuesta: </span>
            {row.replyText}
          </p>
        ) : null}
        {row.errorMessage ? (
          <p className="text-destructive text-xs">{row.errorMessage}</p>
        ) : null}
      </div>
    </div>
  )
}

export function MetaCommentsActivity({
  items,
  loading,
  filter,
  onFilterChange,
}: {
  items: MetaCommentDecisionRecord[] | undefined
  loading: boolean
  filter: MetaCommentActivityFilter
  onFilterChange: (filter: MetaCommentActivityFilter) => void
}) {
  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      <div className="border-b px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <RiChat3Line className="size-4" />
          </div>
          <div>
            <h2 className="font-semibold">Actividad reciente</h2>
            <p className="text-muted-foreground text-sm">
              Últimos comentarios procesados y acciones de IA
            </p>
          </div>
        </div>
      </div>

      <Tabs
        value={filter}
        onValueChange={(v) => onFilterChange(v as MetaCommentActivityFilter)}
        className="gap-0"
      >
        <div className="border-b px-5 py-3">
          <TabsList className="w-full justify-start sm:w-auto">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="replies">Respuestas</TabsTrigger>
            <TabsTrigger value="deleted">Ocultados</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={filter} className="mt-0">
          {loading ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : items?.length ? (
            <div>{items.map((row) => <ActivityRow key={row.id} row={row} />)}</div>
          ) : (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <div className="bg-muted flex size-16 items-center justify-center rounded-full">
                <RiChat3Line className="text-muted-foreground size-7" />
              </div>
              <p className="mt-4 font-medium">Sin actividad en este período</p>
              <p className="text-muted-foreground mt-1 max-w-sm text-sm">
                Cuando el agente procese comentarios aparecerán acá con la
                acción tomada por Claude.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
