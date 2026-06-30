/** Añade connect_timeout para cold start de Neon en CI. */
function withConnectTimeout(url: string): string {
  try {
    const parsed = new URL(url)
    if (!parsed.searchParams.has("connect_timeout")) {
      parsed.searchParams.set("connect_timeout", "60")
    }
    if (!parsed.searchParams.has("sslmode")) {
      parsed.searchParams.set("sslmode", "require")
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

function normalizeNeonEndpoint(hostname: string): string | null {
  const head = hostname.toLowerCase().split(".")[0] ?? ""
  if (!head.startsWith("ep-")) return null
  return head.replace(/-pooler$/u, "")
}

function sameNeonProject(a: string, b: string): boolean {
  try {
    const idA = normalizeNeonEndpoint(new URL(a).hostname)
    const idB = normalizeNeonEndpoint(new URL(b).hostname)
    if (!idA || !idB) return true
    return idA === idB
  } catch {
    return true
  }
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

function pooledDatabaseUrl(): string | null {
  return (
    process.env.DATABASE_URL?.trim() ??
    process.env.POSTGRES_URL?.trim() ??
    null
  )
}

function addCandidate(
  candidates: string[],
  seen: Set<string>,
  url: string | null | undefined,
  referencePooled: string | null
) {
  if (!url?.trim()) return

  const trimmed = url.trim()
  if (referencePooled && !sameNeonProject(trimmed, referencePooled)) {
    if (process.env.VERCEL === "1") {
      console.warn(
        `[prisma migrate] omitiendo URL directa (${new URL(trimmed).hostname}) distinta a DATABASE_URL (${new URL(referencePooled).hostname})`
      )
    }
    return
  }

  const normalized = withConnectTimeout(trimmed)
  if (isPoolerDatabaseUrl(normalized)) return
  if (seen.has(normalized)) return

  seen.add(normalized)
  candidates.push(normalized)
}

/**
 * URLs directas para Prisma CLI (migrate deploy), en orden de preferencia.
 * Prioriza derivar desde DATABASE_URL pooled (integración Vercel+Neon actual)
 * y descarta UNPOOLED obsoletos de un proyecto Neon distinto.
 */
export function migrationDatabaseUrlCandidates(): string[] {
  const candidates: string[] = []
  const seen = new Set<string>()
  const pooled = pooledDatabaseUrl()

  if (pooled && isPoolerDatabaseUrl(pooled)) {
    addCandidate(candidates, seen, deriveDirectFromPooled(pooled), null)
  }

  const explicit = [
    process.env.DIRECT_URL,
    process.env.DATABASE_DIRECT_URL,
    process.env.DATABASE_URL_UNPOOLED,
    process.env.POSTGRES_URL_NON_POOLING,
    fromPgEnvUnpooled(),
    process.env.POSTGRES_PRISMA_URL,
  ]

  for (const value of explicit) {
    addCandidate(candidates, seen, value, pooled)
  }

  if (pooled && !isPoolerDatabaseUrl(pooled)) {
    addCandidate(candidates, seen, pooled, null)
  }

  if (candidates.length === 0) {
    throw new Error(
      "Falta DATABASE_URL o DATABASE_URL_UNPOOLED en Vercel (Build + Production). " +
        "Neon: copia la connection string «Direct» como DATABASE_URL_UNPOOLED."
    )
  }

  return candidates
}

/**
 * URL para Prisma CLI (migrate deploy). Advisory locks fallan con pooler.
 */
export function migrationDatabaseUrl(): string {
  const [first] = migrationDatabaseUrlCandidates()
  return first!
}
