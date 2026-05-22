/**
 * URL para Prisma CLI (migrate). Advisory locks fallan con el pooler de Neon.
 * Orden: DIRECT_URL → quitar "-pooler" del host → DATABASE_URL.
 */
export function migrationDatabaseUrl(): string {
  const direct = process.env.DIRECT_URL ?? process.env.DATABASE_DIRECT_URL
  if (direct?.trim()) return direct.trim()

  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    throw new Error("DATABASE_URL is required for Prisma migrations")
  }

  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes("-pooler")) {
      parsed.hostname = parsed.hostname.replace("-pooler", "")
      return parsed.toString()
    }
  } catch {
    // URL inválida: Prisma fallará con mensaje claro
  }

  return url
}
