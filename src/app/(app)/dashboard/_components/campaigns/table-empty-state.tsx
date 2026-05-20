"use client"

import { TableCell, TableRow } from "@/components/ui/table"

interface TableEmptyStateProps {
  columnsCount: number
}

export function TableEmptyState({ columnsCount }: TableEmptyStateProps) {
  return (
    <TableRow>
      <TableCell colSpan={columnsCount} className="h-24 text-center">
        No se encontraron campañas.
      </TableCell>
    </TableRow>
  )
}
