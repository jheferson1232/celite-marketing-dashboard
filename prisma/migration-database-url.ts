/**
 * URL para Prisma CLI (migrate deploy). Advisory locks fallan con pooler (Neon/PgBouncer).
 * Prioridad: URLs explícitas sin pool → derivar quitando "-pooler" del host.
 */
export function migrationDatabaseUrl(): string {
  const explicit = [
    process.env.DIRECT_URL,
    process.env.DATABASE_DIRECT_URL,
    process.env.DATABASE_URL_UNPOOLED,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL_NON_POOLING,
  ]
  for (const value of explicit) {
    if (value?.trim()) return value.trim()
  }

  const pooled =
    process.env.DATABASE_URL?.trim() ?? process.env.POSTGRES_URL?.trim()
  if (!pooled) {
    throw new Error(
      "Falta DATABASE_URL (o DATABASE_URL_UNPOOLED / DIRECT_URL) en el entorno de build de Vercel. " +
        "Activa la variable para Production + Preview + Development y redeploy."
    )
  }

  try {
    const parsed = new URL(pooled)
    if (parsed.hostname.includes("-pooler")) {
      parsed.hostname = parsed.hostname.replace("-pooler", "")
      if (process.env.VERCEL === "1") {
        console.log(
          `[prisma migrate] Host directo derivado: ${parsed.hostname} (desde pooler)`
        )
      }
      return parsed.toString()
    }
  } catch {
    // Prisma mostrará error de URL inválida
  }

  return pooled
}
