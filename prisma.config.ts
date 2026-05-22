import "dotenv/config"
import { defineConfig } from "prisma/config"

import { migrationDatabaseUrl } from "./prisma/migration-database-url"

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Conexión directa (no pooler) para migrate deploy en CI/Vercel
    url: migrationDatabaseUrl(),
  },
})
