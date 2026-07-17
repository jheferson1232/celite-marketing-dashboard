"use client"

import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { RiChat3Line } from "@remixicon/react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type {
  TikTokCommentActivityFilter,
  TikTokCommentDecisionRecord,
  TikTokLiveComment,
} from "@/lib/services/tiktok/comments/types"

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

function ActivityRow({ row }: { row: TikTokCommentDecisionRecord }) {
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
          {row.adId ? (
            <span className="text-muted-foreground text-xs">· Ad {row.adId}</span>
          ) : null}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {row.authorName ?? "Usuario de TikTok"}
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

function LiveCommentRow({ row }: { row: TikTokLiveComment }) {
  const when = formatDistanceToNow(new Date(row.createdTime), {
    addSuffix: true,
    locale: es,
  })

  return (
    <div className="flex gap-3 border-b px-4 py-4 last:border-b-0">
      <div className="bg-rose-500/70 mt-1 h-full w-1 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {row.processed ? (
            <Badge variant="secondary" className="text-[10px]">
              Ya procesado
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              Pendiente
            </Badge>
          )}
          <span className="text-muted-foreground text-xs">{when}</span>
          {row.profileName ? (
            <span className="text-xs font-medium">@{row.profileName}</span>
          ) : null}
          <span className="text-muted-foreground text-xs">· {row.adName}</span>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {row.authorName ?? "Usuario de TikTok"}
          </p>
          <p className="text-sm">{row.message}</p>
        </div>
      </div>
    </div>
  )
}

export function TikTokCommentsActivity({
  items,
  liveItems,
  liveMeta,
  loading,
  liveLoading,
  filter,
  onFilterChange,
  view,
  onViewChange,
}: {
  items: TikTokCommentDecisionRecord[] | undefined
  liveItems: TikTokLiveComment[] | undefined
  liveMeta?: {
    adsScanned: number
    sparkTargetAds?: number
    adgroupsScanned?: number
    fetchErrors: string[]
  }
  loading: boolean
  liveLoading: boolean
  filter: TikTokCommentActivityFilter
  onFilterChange: (filter: TikTokCommentActivityFilter) => void
  view: "live" | "processed"
  onViewChange: (view: "live" | "processed") => void
}) {
  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      <div className="border-b px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <RiChat3Line className="size-4" />
          </div>
          <div>
            <h2 className="font-semibold">Comentarios</h2>
            <p className="text-muted-foreground text-sm">
              En TikTok (en vivo) y procesados por el agente de IA
            </p>
          </div>
        </div>
      </div>

      <Tabs
        value={view}
        onValueChange={(v) => onViewChange(v as "live" | "processed")}
        className="gap-0"
      >
        <div className="border-b px-5 py-3">
          <TabsList className="w-full justify-start sm:w-auto">
            <TabsTrigger value="live">En TikTok</TabsTrigger>
            <TabsTrigger value="processed">Procesados por IA</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="live" className="mt-0">
          {liveMeta ? (
            <p className="text-muted-foreground border-b px-5 py-3 text-xs">
              {liveMeta.sparkTargetAds != null && liveMeta.sparkTargetAds > 0
                ? `${liveMeta.sparkTargetAds} ads Spark (Calzados_urbanos / Calzados Elite)`
                : `${liveMeta.adsScanned} anuncio(s) activo(s)`}
              {liveMeta.adgroupsScanned != null
                ? ` · ${liveMeta.adgroupsScanned} adgroups`
                : ""}{" "}
              · ventana 7 días
            </p>
          ) : null}
          {liveLoading ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : liveItems?.length ? (
            <div>
              {liveItems.map((row) => (
                <LiveCommentRow key={row.id} row={row} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <div className="bg-muted flex size-16 items-center justify-center rounded-full">
                <RiChat3Line className="text-muted-foreground size-7" />
              </div>
              <p className="mt-4 font-medium">Sin comentarios en TikTok (7 días)</p>
              <p className="text-muted-foreground mt-1 max-w-md text-sm">
                Monitoreamos ads Spark de @Calzados_urbanos y @Calzados Elite.
                Si los conjuntos tenían comentarios desactivados, usá
                «Habilitar comentarios Spark» y esperá comentarios nuevos
                (los históricos con comments off no aparecen en la API).
              </p>
            </div>
          )}
          {liveMeta?.fetchErrors.length ? (
            <div className="border-t px-5 py-3">
              {liveMeta.fetchErrors.slice(0, 3).map((error) => (
                <p key={error} className="text-destructive text-xs">
                  {error}
                </p>
              ))}
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="processed" className="mt-0">
          <Tabs
            value={filter}
            onValueChange={(v) =>
              onFilterChange(v as TikTokCommentActivityFilter)
            }
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
                <div>
                  {items.map((row) => (
                    <ActivityRow key={row.id} row={row} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                  <div className="bg-muted flex size-16 items-center justify-center rounded-full">
                    <RiChat3Line className="text-muted-foreground size-7" />
                  </div>
                  <p className="mt-4 font-medium">
                    Sin actividad procesada en este período
                  </p>
                  <p className="text-muted-foreground mt-1 max-w-md text-sm">
                    Esta pestaña muestra comentarios ya clasificados por el
                    agente. Usá «Ejecutar ahora» (dry run primero) o revisá la
                    pestaña «En TikTok» para ver comentarios en vivo.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  )
}
