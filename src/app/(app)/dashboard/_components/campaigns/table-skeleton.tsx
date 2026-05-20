"use client"

import { TableCell, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

interface TableSkeletonProps {
  rowsCount?: number
  columnsCount: number
}

export function TableSkeleton({
  rowsCount = 5,
  columnsCount,
}: TableSkeletonProps) {
  return Array.from({ length: rowsCount }).map((_, rowIndex) => (
    <TableRow key={rowIndex}>
      {Array.from({ length: columnsCount }).map((_, cellIndex) => (
        <TableCell key={`${rowIndex}-${cellIndex}`}>
          <Skeleton className="h-4 w-full" />
        </TableCell>
      ))}
    </TableRow>
  ))
}
