import "dotenv/config"
import { execSync } from "node:child_process"
import { migrationDatabaseUrl } from "../prisma/migration-database-url.ts"

function runMigrate(env) {
  execSync("pnpm exec prisma migrate deploy", { stdio: "inherit", env })
}

const directUrl = migrationDatabaseUrl()
const host = new URL(directUrl).hostname

console.log(`[build] prisma migrate deploy → ${host}`)

const migrateEnv = {
  ...process.env,
  DATABASE_URL: directUrl,
  DIRECT_URL: directUrl,
}

try {
  runMigrate(migrateEnv)
} catch {
  console.warn("[build] migrate falló; reintento en 5s (Neon cold start / advisory lock)...")
  execSync("sleep 5")
  runMigrate(migrateEnv)
}

execSync("pnpm exec next build", { stdio: "inherit", env: process.env })
