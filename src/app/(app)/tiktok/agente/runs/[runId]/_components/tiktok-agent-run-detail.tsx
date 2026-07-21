"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { runServerAction } from "@/lib/server-action"
import { formatCurrency } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { getTikTokAgentRunAction } from "../../../_actions/tiktok-agent"

export function TikTokAgentRunDetail({ runId }: { runId: string }) {
  const { data: run, isLoading } = useQuery({
    queryKey: ["tiktok-agent-run", runId],
    queryFn: () => runServerAction(getTikTokAgentRunAction(runId)),
  })

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8">
        <Skeleton className="h-8 w-64" />
      </div>
    )
  }

  if (!run) {
    return (
      <div className="p-6 lg:p-8">
        <p>Corrida no encontrada.</p>
        <Link href="/tiktok/agente" className="text-primary mt-4 inline-block">
          ← Volver al agente
        </Link>
      </div>
    )
  }

  const started = new Date(run.startedAt).toLocaleString("es-PE", {
    timeZone: "America/Lima",
  })

  return (
    <div className="flex w-full flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <p className="text-muted-foreground text-sm">
          <Link href="/tiktok/agente">Agente automático</Link>
          <span className="mx-2">/</span>
          <span className="font-mono text-xs">{runId}</span>
        </p>
        <h1 className="mt-2 text-xl font-bold">Detalle de corrida</h1>
        <p className="text-muted-foreground mt-1 text-sm">{started}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumen</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Trigger:</span> {run.trigger}
            {run.dryRun ? " (dry run)" : ""}
          </p>
          <p>
            <span className="text-muted-foreground">Estado:</span>{" "}
            <Badge>{run.status}</Badge>
          </p>
          <p>
            <span className="text-muted-foreground">Campañas:</span>{" "}
            {run.campaignsScanned}
          </p>
          <p>
            <span className="text-muted-foreground">Conjuntos:</span>{" "}
            {run.adgroupsScanned}
          </p>
          <p className="sm:col-span-2">
            <span className="text-muted-foreground">Mensaje:</span>{" "}
            {run.summary ?? run.errorMessage ?? "—"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Acciones ({run.actions.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0 sm:p-6 sm:pt-0">
          {run.actions.length === 0 ? (
            <p className="text-muted-foreground p-6 text-sm">
              No se planificaron acciones en esta corrida.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Gasto hoy</TableHead>
                  <TableHead>Compras</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Resultado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {run.actions.map((action) => (
                  <TableRow key={`${action.kind}-${action.entityId}`}>
                    <TableCell className="text-xs">
                      {action.kind === "pause_campaign"
                        ? "Pausa campaña"
                        : action.kind === "scale_adgroup"
                          ? "Escalado"
                          : "Pausa conjunto"}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{action.entityName}</div>
                      {action.campaignName ? (
                        <div className="text-muted-foreground text-xs">
                          {action.campaignName}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>{formatCurrency(action.spendPen, "PEN")}</TableCell>
                    <TableCell>{action.purchases}</TableCell>
                    <TableCell className="max-w-xs text-xs">
                      {action.reason}
                    </TableCell>
                    <TableCell>
                      {run.dryRun ? (
                        <Badge variant="outline">Simulado</Badge>
                      ) : action.applied ? (
                        <Badge>Aplicado</Badge>
                      ) : (
                        <Badge variant="destructive">
                          {action.error ?? "No aplicado"}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Link
        href="/tiktok/agente"
        className="text-primary text-sm underline-offset-4 hover:underline"
      >
        ← Agente automático
      </Link>
    </div>
  )
}
