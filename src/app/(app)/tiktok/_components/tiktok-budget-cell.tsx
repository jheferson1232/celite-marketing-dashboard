"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  canEditTikTokDailyBudget,
  type TikTokManageEntity,
} from "./tiktok-manage-types"
import {
  useTikTokDashboardCurrency,
  useTikTokManage,
} from "./tiktok-manage-provider"

interface TikTokBudgetCellProps {
  entity: TikTokManageEntity
  className?: string
}

export function TikTokBudgetCell({ entity, className }: TikTokBudgetCellProps) {
  const currency = useTikTokDashboardCurrency()
  const { isEntityPending, getEntityError, setEntityBudget } = useTikTokManage()
  const isPending = isEntityPending(entity)
  const errorMessage = getEntityError(entity)
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState("")

  const canEdit = canEditTikTokDailyBudget(entity)
  const displayBudget = entity.dailyBudget

  React.useEffect(() => {
    if (open) {
      setValue(
        displayBudget != null && displayBudget > 0 ? String(displayBudget) : ""
      )
    }
  }, [open, displayBudget])

  if (!canEdit) {
    return (
      <div className={cn("text-right text-muted-foreground", className)}>—</div>
    )
  }

  const handleSave = () => {
    const budget = Number(value.replace(",", "."))
    if (!Number.isFinite(budget)) return
    setEntityBudget(entity, budget)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full cursor-pointer rounded px-1 py-0.5 text-right text-sm tabular-nums underline decoration-dotted underline-offset-2 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className
          )}
          disabled={isPending}
          onClick={(e) => e.stopPropagation()}
        >
          {displayBudget != null && displayBudget > 0
            ? formatCurrency(displayBudget, currency)
            : "Definir"}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-3 p-4">
        <p className="text-sm font-medium text-muted-foreground">Diario</p>
        <div className="relative">
          <Input
            type="number"
            min={1}
            step={0.01}
            inputMode="decimal"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            disabled={isPending}
            className="pr-14"
            aria-label="Presupuesto diario"
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-medium text-muted-foreground">
            {currency}
          </span>
        </div>
        {errorMessage ? (
          <p className="text-xs text-destructive">{errorMessage}</p>
        ) : null}
        <div className="flex items-center justify-between gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-muted-foreground"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8"
            onClick={handleSave}
            disabled={isPending}
          >
            {isPending ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
