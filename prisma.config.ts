import "dotenv/config"
import { defineConfig } from "prisma/config"

/**
 * URL para Prisma CLI (migrate deploy / generate).
 *
 * Prisma migrate necesita conexión directa (unpooled): los advisory locks
 * fallan a través de PgBouncer (pooler). En Vercel+Neon, `DATABASE_URL_UNPOOLED`
 * es la conexión directa y `DATABASE_URL` la pooled (runtime). En local,
 * `DATABASE_URL` apunta a localhost (sin pooler) y basta.
 *
 * `postinstall` (prisma generate) puede correr antes de que Vercel inyecte las
 * env vars, por eso hay un placeholder de fallback que evita que rompa el build.
 */
function datasourceUrl(): string {
  return (
    process.env.DATABASE_URL_UNPOOLED?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    "postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder?schema=public"
  )
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: datasourceUrl(),
  },
})
