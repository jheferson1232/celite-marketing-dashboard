/** Añade connect_timeout para cold start de Neon en CI. */
function withConnectTimeout(url: string): string {
  try {
    const parsed = new URL(url)
    if (!parsed.searchParams.has("connect_timeout")) {
      parsed.searchParams.set("connect_timeout", "30")
    }
    return parsed.toString()
  } catch {
    return url
  }
}

/** true si la URL parece pooler (PgBouncer / Neon pooler). */
export function isPoolerDatabaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    if (host.includes("pooler") || host.includes("pgbouncer")) return true
    if (parsed.port === "6543") return true
    const mode = parsed.searchParams.get("pgbouncer")?.toLowerCase()
    if (mode === "true" || mode === "transaction") return true
  } catch {
    return false
  }
  return false
}

function fromPgEnvUnpooled(): string | null {
  const host = process.env.PGHOST_UNPOOLED?.trim()
  if (!host || host.toLowerCase().includes("pooler")) return null

  const user = process.env.PGUSER?.trim()
  const password = process.env.PGPASSWORD
  const database = process.env.PGDATABASE?.trim()
  if (!user || password === undefined || !database) return null

  const parsed = new URL(
    `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}/${database}`
  )
  parsed.searchParams.set("sslmode", "require")
  return withConnectTimeout(parsed.toString())
}

function deriveDirectFromPooled(pooled: string): string {
  const parsed = new URL(pooled)
  const host = parsed.hostname

  if (host.includes("-pooler")) {
    parsed.hostname = host.replace(/-pooler/g, "")
  } else if (host.includes("pooler.")) {
    parsed.hostname = host.replace(/\.?pooler\./g, ".")
  }

  if (parsed.port === "6543") parsed.port = "5432"

  parsed.searchParams.delete("pgbouncer")
  parsed.searchParams.delete("connection_limit")

  return withConnectTimeout(parsed.toString())
}

/**
 * URL para Prisma CLI (migrate deploy). Advisory locks fallan con pooler.
 */
export function migrationDatabaseUrl(): string {
  const explicit = [
    process.env.DIRECT_URL,
    process.env.DATABASE_DIRECT_URL,
    process.env.DATABASE_URL_UNPOOLED,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL_NON_POOLING,
    fromPgEnvUnpooled(),
  ]

  for (const value of explicit) {
    if (!value?.trim()) continue
    const url = withConnectTimeout(value.trim())
    if (!isPoolerDatabaseUrl(url)) return url
  }

  const pooled =
    process.env.DATABASE_URL?.trim() ?? process.env.POSTGRES_URL?.trim()
  if (!pooled) {
    throw new Error(
      "Falta DATABASE_URL o DATABASE_URL_UNPOOLED en Vercel (Build + Production). " +
        "Neon: copia la connection string «Direct» como DATABASE_URL_UNPOOLED."
    )
  }

  if (!isPoolerDatabaseUrl(pooled)) {
    return withConnectTimeout(pooled)
  }

  const direct = deriveDirectFromPooled(pooled)
  if (process.env.VERCEL === "1") {
    console.log(
      `[prisma migrate] URL directa derivada → host ${new URL(direct).hostname}`
    )
  }
  return direct
}
