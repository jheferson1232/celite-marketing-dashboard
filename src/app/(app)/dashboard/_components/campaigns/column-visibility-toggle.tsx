"use client"

import type { Table } from "@tanstack/react-table"
import { RiSettings3Line } from "@remixicon/react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { CampaignRow } from "@/lib/services/meta/types"
import type { CampaignColumnMeta } from "./types"

interface ColumnVisibilityToggleProps {
  table: Table<CampaignRow>
}

export function ColumnVisibilityToggle({ table }: ColumnVisibilityToggleProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0 gap-2">
          <RiSettings3Line className="h-4 w-4" />
          Columnas
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {table
          .getAllLeafColumns()
          .filter((column) => column.getCanHide())
          .map((column) => {
          const meta = column.columnDef.meta as CampaignColumnMeta | undefined

          return (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={column.getIsVisible()}
              onCheckedChange={(checked) =>
                column.toggleVisibility(Boolean(checked))
              }
            >
              {meta?.label ?? column.id}
            </DropdownMenuCheckboxItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
