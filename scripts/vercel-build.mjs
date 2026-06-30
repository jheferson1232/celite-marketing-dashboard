import "dotenv/config"
import { execSync } from "node:child_process"
import {
  migrationDatabaseUrlCandidates,
  pooledDatabaseUrl,
} from "../prisma/migration-database-url.ts"

const RETRY_DELAYS_MS = [0, 10_000, 20_000, 30_000]

function sleep(ms) {
  if (ms <= 0) return
  execSync(`sleep ${Math.ceil(ms / 1000)}`)
}

function runMigrate(env) {
  execSync("pnpm exec prisma migrate deploy", { stdio: "inherit", env })
}

function runDbPush(env) {
  execSync("pnpm exec prisma db push --skip-generate", { stdio: "inherit", env })
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
      return true
    } catch (error) {
      lastError = error
      const remaining = RETRY_DELAYS_MS.length - attempt - 1
      if (remaining <= 0) break
      console.warn(
        `[build] migrate falló (${host}); reintento en ${RETRY_DELAYS_MS[attempt + 1] / 1000}s...`
      )
    }
  }

  throw lastError
}

function tryDbPushFallback() {
  const pooled = pooledDatabaseUrl()
  if (!pooled) {
    console.warn("[build] sin URL pooled para db push fallback")
    return false
  }

  const host = new URL(pooled).hostname
  console.log(`[build] fallback prisma db push → ${host}`)

  const env = {
    ...process.env,
    DATABASE_URL: pooled,
    DIRECT_URL: pooled,
  }

  try {
    runDbPush(env)
    return true
  } catch (error) {
    console.warn("[build] db push fallback falló:", error instanceof Error ? error.message : error)
    return false
  }
}

let migrated = false

try {
  const candidates = migrationDatabaseUrlCandidates()

  for (let index = 0; index < candidates.length; index += 1) {
    const directUrl = candidates[index]
    try {
      migrateWithRetries(directUrl)
      migrated = true
      break
    } catch (error) {
      const next = candidates[index + 1]
      if (!next) break
      console.warn(
        `[build] migrate falló con ${new URL(directUrl).hostname}; probando ${new URL(next).hostname}...`
      )
    }
  }
} catch (error) {
  console.warn(
    "[build] no se pudieron resolver URLs directas:",
    error instanceof Error ? error.message : error
  )
}

if (!migrated) {
  migrated = tryDbPushFallback()
}

if (!migrated) {
  console.warn(
    "[build] ADVERTENCIA: migraciones omitidas (Neon inaccesible en build). " +
      "Continuando next build; si la app falla en runtime, revisa DATABASE_URL en Vercel."
  )
}

execSync("pnpm exec next build", { stdio: "inherit", env: process.env })
