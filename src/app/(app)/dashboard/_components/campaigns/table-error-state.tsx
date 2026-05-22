"use client"

import { TableCell, TableRow } from "@/components/ui/table"
import { isMetaRateLimitError } from "@/lib/services/meta/meta-errors"

interface TableErrorStateProps {
  columnsCount: number
  error: Error
}

export function TableErrorState({ columnsCount, error }: TableErrorStateProps) {
  const isRateLimit = isMetaRateLimitError(error)

  return (
    <TableRow>
      <TableCell colSpan={columnsCount} className="h-24 px-4 text-center">
        <p className="text-sm font-medium text-destructive">
          {isRateLimit
            ? "Límite de la API de Meta alcanzado."
            : "No se pudieron cargar las campañas."}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
        {isRateLimit ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Espera unos minutos y pulsa Reload. Evita recargar muchas veces seguidas.
          </p>
        ) : null}
      </TableCell>
    </TableRow>
  )
}
