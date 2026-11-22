"use client"

import { useState } from "react"
import { RiCheckboxCircleLine } from "@remixicon/react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { describeInformeReason } from "@/lib/services/meta/meta-informe-rules"
import type {
  InformeActionItem,
  MetaInformePayload,
} from "@/lib/services/meta/meta-operative-service"
import { ACCION_STYLE, moneyFormatter } from "./informe-format"

const LANES: Array<{
  accion: InformeActionItem["accion"]
  rule: string
}> = [
  {
    accion: "apagar",
    rule: "gasto ≥ 1.5× objetivo sin compras, o 2 días seguidos en Revisar",
  },
  { accion: "revisar", rule: "CPA > 1.5× objetivo, o gasto ≥ 1× sin compras" },
  {
    accion: "reactivar",
    rule: "apagado con CPA del periodo bajo el objetivo y ≥ 3 compras",
  },
]

type StatusChange = { item: InformeActionItem; status: "ACTIVE" | "PAUSED" }

export function InformeActions({
  data,
  onChangeStatus,
  pendingAdsetId,
  error,
}: {
  data: MetaInformePayload
  onChangeStatus: (change: { adsetId: string; status: "ACTIVE" | "PAUSED" }) => void
  pendingAdsetId: string | null
  error: string | null
}) {
  const money = moneyFormatter(data.account.currency)
  const [confirm, setConfirm] = useState<StatusChange | null>(null)

  if (data.actions.length === 0) {
    return (
      <div className="bg-card flex items-center gap-3 rounded-xl border px-4 py-5">
        <RiCheckboxCircleLine className="size-6 shrink-0 text-emerald-600" />
        <div>
          <p className="font-medium">Nada que hacer ahora</p>
          <p className="text-muted-foreground text-sm">
            Ningún conjunto para apagar, revisar o reactivar con el objetivo de{" "}
            {money(data.cpaTarget)}.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {error ? (
        <p className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-sm">
          {error}
        </p>
      ) : null}
      {LANES.map((lane) => {
        const items = data.actions.filter((a) => a.accion === lane.accion)
        if (items.length === 0) return null
        const style = ACCION_STYLE[lane.accion]
        return (
          <section key={lane.accion} className="flex flex-col gap-2">
            <h3 className="flex flex-wrap items-center gap-2 text-sm">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-semibold",
                  style.pill
                )}
              >
                {style.label} · {items.length}
              </span>
              <span className="text-muted-foreground text-xs">{lane.rule}</span>
            </h3>
            {items.map((item) => {
              const nextStatus =
                item.accion === "reactivar" ? "ACTIVE" : "PAUSED"
              const busy = pendingAdsetId === item.metaId
              return (
                <div
                  key={item.metaId}
                  className="bg-card grid grid-cols-[4px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border py-2.5 pr-3"
                >
                  <span
                    aria-hidden
                    className={cn("self-stretch rounded-r-sm", style.bar)}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {item.campaignName}
                      </span>
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {describeInformeReason(item.reason, money)}
                    </p>
                  </div>
                  {item.accion === "revisar" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        setConfirm({ item, status: "PAUSED" })
                      }
                    >
                      {busy ? "Apagando…" : "Apagar"}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant={item.accion === "apagar" ? "destructive" : "default"}
                      disabled={busy}
                      onClick={() => setConfirm({ item, status: nextStatus })}
                    >
                      {busy
                        ? nextStatus === "PAUSED"
                          ? "Apagando…"
                          : "Activando…"
                        : nextStatus === "PAUSED"
                          ? "Apagar"
                          : "Activar"}
                    </Button>
                  )}
                </div>
              )
            })}
          </section>
        )
      })}

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm?.status === "PAUSED" ? "¿Apagar" : "¿Activar"} el conjunto?
            </DialogTitle>
            <DialogDescription>
              <span className="text-foreground font-medium">{confirm?.item.name}</span>{" "}
              en {confirm?.item.campaignName} ({data.account.name}). Se aplica
              en Meta al instante.
            </DialogDescription>
          </DialogHeader>
          {confirm ? (
            <p className="text-muted-foreground text-sm">
              {describeInformeReason(confirm.item.reason, money)}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancelar
            </Button>
            <Button
              variant={confirm?.status === "PAUSED" ? "destructive" : "default"}
              onClick={() => {
                if (!confirm) return
                onChangeStatus({
                  adsetId: confirm.item.metaId,
                  status: confirm.status,
                })
                setConfirm(null)
              }}
            >
              {confirm?.status === "PAUSED" ? "Apagar" : "Activar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
