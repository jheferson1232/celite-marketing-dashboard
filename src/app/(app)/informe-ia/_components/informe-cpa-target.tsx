"use client"

import { useState } from "react"
import { RiPencilLine } from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { CurrencyCode } from "@/lib/format"
import { moneyFormatter } from "./informe-format"

export function InformeCpaTarget({
  value,
  currency,
  accountName,
  saving,
  error,
  onSave,
}: {
  value: number
  currency: CurrencyCode
  accountName: string
  saving: boolean
  error: string | null
  onSave: (value: number) => void
}) {
  const money = moneyFormatter(currency)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(String(value))

  const parsed = Number(draft.replace(/,/g, ""))
  const valid = Number.isFinite(parsed) && parsed > 0

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setDraft(String(value))
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          CPA objetivo: {money(value)}
          <RiPencilLine className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (!valid) return
            onSave(parsed)
            setOpen(false)
          }}
        >
          <div>
            <p className="text-sm font-medium">CPA objetivo · {accountName}</p>
            <p className="text-muted-foreground text-xs">
              En {currency === "PEN" ? "soles" : currency === "COP" ? "pesos" : currency}.
              De aquí salen Apagar, Revisar, Excelente y Reactivar.
            </p>
          </div>
          <Input
            inputMode="decimal"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label="CPA objetivo"
            autoFocus
          />
          {valid ? (
            <ul className="text-muted-foreground space-y-0.5 text-xs">
              <li>Excelente: CPA &lt; {money(parsed * 0.8)}</li>
              <li>Revisar: CPA &gt; {money(parsed * 1.5)} o {money(parsed)} sin compras</li>
              <li>Apagar: {money(parsed * 1.5)} sin compras</li>
            </ul>
          ) : (
            <p className="text-destructive text-xs">Escribe un número mayor que 0.</p>
          )}
          {error ? <p className="text-destructive text-xs">{error}</p> : null}
          <Button type="submit" size="sm" disabled={!valid || saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
