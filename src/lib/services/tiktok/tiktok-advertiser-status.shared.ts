export type TikTokAdvertiserStatusKind =
  | "operational"
  | "limited"
  | "suspended"
  | "pending"
  | "unknown"

export type TikTokAdvertiserStatusDisplay = {
  kind: TikTokAdvertiserStatusKind
  label: string
  raw: string | null
}

/** Estado devuelto por TikTok en GET /advertiser/info/ → campo `status`. */
export function parseTikTokAdvertiserStatus(
  raw: string | null | undefined
): TikTokAdvertiserStatusDisplay {
  const normalized = raw?.trim() || null
  if (!normalized) {
    return { kind: "unknown", label: "Sin verificar", raw: null }
  }

  const upper = normalized.toUpperCase()

  if (
    upper.includes("SUSPEND") ||
    upper.includes("DISABLE") ||
    upper.includes("BANNED") ||
    upper.includes("CLOSED") ||
    upper.includes("CONFIRM_FAIL")
  ) {
    return {
      kind: "suspended",
      label: upper.includes("DISABLE") ? "Deshabilitada" : "Suspendida",
      raw: normalized,
    }
  }

  if (upper.includes("LIMIT") || upper.includes("RESTRICT")) {
    return { kind: "limited", label: "Limitada", raw: normalized }
  }

  if (upper.includes("PENDING") || upper.includes("VERIFY")) {
    return { kind: "pending", label: "Pendiente", raw: normalized }
  }

  if (upper.includes("ENABLE") || upper === "ACTIVE" || upper === "STATUS_ENABLE") {
    return { kind: "operational", label: "Operativa", raw: normalized }
  }

  return { kind: "unknown", label: normalized, raw: normalized }
}

export function tikTokAdvertiserStatusBadgeClass(
  kind: TikTokAdvertiserStatusKind
): string {
  switch (kind) {
    case "operational":
      return "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
    case "limited":
    case "pending":
      return "border-amber-500/40 text-amber-600 dark:text-amber-400"
    case "suspended":
      return "border-destructive/40 text-destructive"
    default:
      return "text-muted-foreground"
  }
}
