"use client"

import { TableCell, TableRow } from "@/components/ui/table"
import { MetaConfigErrorHint } from "@/components/meta-config-error-hint"
import {
  isMetaConfigError,
  isMetaRateLimitError,
} from "@/lib/services/meta/meta-errors"

interface TableErrorStateProps {
  columnsCount: number
  error: Error
}

export function TableErrorState({ columnsCount, error }: TableErrorStateProps) {
  const isRateLimit = isMetaRateLimitError(error)
  const isConfig = isMetaConfigError(error)

  const title = isConfig
    ? "Meta no está configurado en este entorno."
    : isRateLimit
      ? "Límite de la API de Meta alcanzado."
      : "No se pudieron cargar las campañas."

  return (
    <TableRow>
      <TableCell colSpan={columnsCount} className="h-24 px-4 text-center">
        <p className="text-sm font-medium text-destructive">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
        {isConfig ? (
          <MetaConfigErrorHint className="text-muted-foreground mx-auto mt-2 max-w-lg list-decimal space-y-1 pl-4 text-left text-xs" />
        ) : null}
        {isRateLimit ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Espera unos minutos y pulsa Reload. Evita recargar muchas veces
            seguidas.
          </p>
        ) : null}
      </TableCell>
    </TableRow>
  )
}
