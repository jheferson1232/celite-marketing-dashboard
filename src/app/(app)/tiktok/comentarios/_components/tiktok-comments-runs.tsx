"use client"

import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TIKTOK_COMMENT_TRIGGER_LABEL } from "@/lib/services/tiktok/comments/constants"
import type { TikTokCommentAgentRunSummary } from "@/lib/services/tiktok/comments/types"

function formatRunWhen(iso: string): string {
  const date = new Date(iso)
  const relative = formatDistanceToNow(date, { addSuffix: true, locale: es })
  const absolute = date.toLocaleString("es-CO", {
    timeZone: "America/Bogota",
  })
  return `${relative}\n${absolute}`
}

export function TikTokCommentsRuns({
  runs,
  loading,
}: {
  runs: TikTokCommentAgentRunSummary[] | undefined
  loading: boolean
}) {
  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      <div className="border-b px-5 py-4">
        <h2 className="font-semibold">Últimas corridas</h2>
        <p className="text-muted-foreground text-sm">
          Historial de ejecuciones automáticas y manuales
        </p>
      </div>
      <div className="overflow-x-auto p-0 sm:p-5 sm:pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cuándo</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ads</TableHead>
              <TableHead className="text-right">Comentarios</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            ) : runs?.length ? (
              runs.map((run) => (
                <TableRow key={run.runId}>
                  <TableCell className="whitespace-pre-line text-xs">
                    {formatRunWhen(run.startedAt)}
                  </TableCell>
                  <TableCell>
                    {TIKTOK_COMMENT_TRIGGER_LABEL[run.trigger] ?? run.trigger}
                    {run.dryRun ? (
                      <Badge variant="outline" className="ml-1 text-[10px]">
                        dry
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        run.status === "success"
                          ? "default"
                          : run.status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {run.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{run.adsScanned}</TableCell>
                  <TableCell className="text-right">
                    {run.commentsSeen}
                  </TableCell>
                  <TableCell className="text-right">
                    {run.actionsCount}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground text-center"
                >
                  Aún no hay corridas.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
