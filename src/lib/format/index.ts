export type CurrencyCode = "COP" | "PEN" | "MX"

export const META_DASHBOARD_CURRENCY: CurrencyCode = "COP"
export const TIKTOK_DASHBOARD_CURRENCY: CurrencyCode = "PEN"

interface CurrencyFormatConfig {
  symbol: string
  decimals: number
  thousandsSeparator: string
  decimalSeparator: string
}

const CURRENCY_FORMAT: Record<CurrencyCode, CurrencyFormatConfig> = {
  COP: {
    symbol: "$",
    decimals: 0,
    thousandsSeparator: ",",
    decimalSeparator: ".",
  },
  PEN: {
    symbol: "S/",
    decimals: 2,
    thousandsSeparator: ",",
    decimalSeparator: ".",
  },
  MX: {
    symbol: "$",
    decimals: 2,
    thousandsSeparator: ",",
    decimalSeparator: ".",
  },
}

function formatAmount(value: number, config: CurrencyFormatConfig): string {
  const absValue = Math.abs(value)
  const sign = value < 0 ? "-" : ""
  const fixed = absValue.toFixed(config.decimals)
  const [integerPart, decimalPart] = fixed.split(".")
  const formattedInteger = integerPart.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    config.thousandsSeparator
  )

  if (config.decimals > 0 && decimalPart !== undefined) {
    return `${sign}${formattedInteger}${config.decimalSeparator}${decimalPart}`
  }

  return `${sign}${formattedInteger}`
}

export function formatCurrency(value: number, currency: CurrencyCode): string {
  const config = CURRENCY_FORMAT[currency]
  return `${config.symbol}${formatAmount(value, config)}`
}

/** Ruta para mostrar en tarjetas (sin dominio ni parámetros UTM/query). */
export function formatLandingPagePath(url: string): string {
  const raw = url.trim()
  if (!raw) return ""

  try {
    const parsed = new URL(raw.startsWith("http") ? raw : `https://${raw}`)
    return parsed.pathname || "/"
  } catch {
    const pathOnly = raw.split("?")[0] ?? raw
    if (pathOnly.startsWith("/")) return pathOnly
    const withoutProtocol = pathOnly.replace(/^https?:\/\//i, "")
    const slashIndex = withoutProtocol.indexOf("/")
    if (slashIndex >= 0) return withoutProtocol.slice(slashIndex).split("?")[0] || "/"
    return `/${withoutProtocol}`
  }
}
