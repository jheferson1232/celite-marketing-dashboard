import { formatCurrency, type CurrencyCode } from "@/lib/format"
import type {
  InformeAccion,
  InformeDayTone,
} from "@/lib/services/meta/meta-informe-rules"

export function moneyFormatter(currency: CurrencyCode) {
  return (value: number) => formatCurrency(value, currency)
}

/** Monto compacto para celdas de la matriz: 18.4k, S/32. */
export function compactMoney(value: number, currency: CurrencyCode): string {
  if (currency === "PEN") return `S/${Math.round(value)}`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return String(Math.round(value))
}

export const ACCION_STYLE: Record<
  InformeAccion,
  { label: string; pill: string; bar: string }
> = {
  apagar: {
    label: "Apagar",
    pill: "bg-red-500/10 text-red-700 dark:text-red-400",
    bar: "bg-red-500",
  },
  revisar: {
    label: "Revisar",
    pill: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    bar: "bg-amber-500",
  },
  reactivar: {
    label: "Reactivar",
    pill: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    bar: "bg-emerald-500",
  },
  en_curso: {
    label: "En curso",
    pill: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    bar: "bg-blue-500",
  },
  excelente: {
    label: "Excelente",
    pill: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    bar: "bg-emerald-500",
  },
  sin_gasto: {
    label: "Sin gasto",
    pill: "bg-muted text-muted-foreground",
    bar: "bg-border",
  },
  apagado: {
    label: "Apagado",
    pill: "bg-muted text-muted-foreground",
    bar: "bg-border",
  },
}

export const TONE_TEXT: Record<InformeDayTone, string> = {
  good: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-red-600 dark:text-red-400",
  neutral: "",
  none: "",
}

export const TONE_CELL: Record<InformeDayTone, string> = {
  good: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  warn: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  bad: "bg-red-500/10 text-red-700 dark:text-red-400",
  neutral: "text-foreground",
  none: "text-muted-foreground",
}
