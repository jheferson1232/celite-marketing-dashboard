"use client"

import type { HeaderContext } from "@tanstack/react-table"
import {
  RiArrowDownSLine,
  RiArrowUpDownLine,
  RiArrowUpSLine,
} from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ColumnTextAlign } from "./types"

interface SortableHeaderProps<TData> {
  context: HeaderContext<TData, unknown>
  label: string
  align?: ColumnTextAlign
  className?: string
}

export function SortableHeader<TData>({
  context,
  label,
  align = "right",
  className,
}: SortableHeaderProps<TData>) {
  const sortState = context.column.getIsSorted()

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "h-8 w-full px-0 font-semibold hover:bg-transparent",
        align === "right"
          ? "justify-end text-right"
          : "justify-start text-left",
        className
      )}
      onClick={() => context.column.toggleSorting(sortState === "asc")}
    >
      {label}
      {sortState === "asc" ? (
        <RiArrowUpSLine className="h-4 w-4" />
      ) : sortState === "desc" ? (
        <RiArrowDownSLine className="h-4 w-4" />
      ) : (
        <RiArrowUpDownLine className="h-4 w-4 text-muted-foreground" />
      )}
    </Button>
  )
}
