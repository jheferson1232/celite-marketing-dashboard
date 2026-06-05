import "dotenv/config"
import { defineConfig } from "prisma/config"

import { migrationDatabaseUrl } from "./prisma/migration-database-url"

/** `prisma generate` no abre conexión; en Vercel postinstall puede correr antes de inyectar env. */
function datasourceUrl(): string {
  try {
    return migrationDatabaseUrl()
  } catch {
    return (
      process.env.DATABASE_URL?.trim() ??
      "postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder?schema=public"
    )
  }
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
