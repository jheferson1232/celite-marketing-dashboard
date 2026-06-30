import "dotenv/config"
import { execSync } from "node:child_process"
import { migrationDatabaseUrlCandidates } from "../prisma/migration-database-url.ts"

const RETRY_DELAYS_MS = [0, 8_000, 15_000]

function sleep(ms) {
  if (ms <= 0) return
  execSync(`sleep ${Math.ceil(ms / 1000)}`)
}

function runMigrate(env) {
  execSync("pnpm exec prisma migrate deploy", { stdio: "inherit", env })
}

function migrateWithRetries(directUrl) {
  const host = new URL(directUrl).hostname
  console.log(`[build] prisma migrate deploy → ${host}`)

  const migrateEnv = {
    ...process.env,
    DATABASE_URL: directUrl,
    DIRECT_URL: directUrl,
  }

  let lastError

  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
    sleep(RETRY_DELAYS_MS[attempt])
    try {
      runMigrate(migrateEnv)
      return
    } catch (error) {
      lastError = error
      const remaining = RETRY_DELAYS_MS.length - attempt - 1
      if (remaining <= 0) break
      console.warn(
        `[build] migrate falló (${host}); reintento en ${RETRY_DELAYS_MS[attempt + 1] / 1000}s (Neon cold start / conexión)...`
      )
    }
  }

  throw lastError
}

const candidates = migrationDatabaseUrlCandidates()
let migrated = false
let lastError

for (let index = 0; index < candidates.length; index += 1) {
  const directUrl = candidates[index]
  try {
    migrateWithRetries(directUrl)
    migrated = true
    break
  } catch (error) {
    lastError = error
    const next = candidates[index + 1]
    if (!next) break
    console.warn(
      `[build] migrate falló con ${new URL(directUrl).hostname}; probando ${new URL(next).hostname}...`
    )
  }
}

if (!migrated) {
  throw lastError ?? new Error("prisma migrate deploy falló sin candidatos")
}

execSync("pnpm exec next build", { stdio: "inherit", env: process.env })
