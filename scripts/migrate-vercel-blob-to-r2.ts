/**
 * CLI wrapper de la migración Vercel Blob → R2.
 * Lógica real en src/lib/services/r2/migrate-from-vercel-blob.ts
 * (compartida con la ruta API /api/migrate-blob-to-r2).
 *
 * Uso:
 *   pnpm exec tsx scripts/migrate-vercel-blob-to-r2.ts --copy
 *   pnpm exec tsx scripts/migrate-vercel-blob-to-r2.ts --rewrite-db --dry-run
 *   pnpm exec tsx scripts/migrate-vercel-blob-to-r2.ts --rewrite-db
 */
import { config } from "dotenv"
config({ path: ".env" })
config({ path: ".env.local", override: true })

import {
  defaultMapPath,
  migrateBlobsToR2,
  rewriteDbUrls,
  type MigrationMap,
} from "@/lib/services/r2/migrate-from-vercel-blob"
import fs from "node:fs/promises"

async function main() {
  const args = new Set(process.argv.slice(2))
  if (args.has("--help")) {
    console.log(
      "Uso: tsx scripts/migrate-vercel-blob-to-r2.ts [--copy] [--rewrite-db] [--dry-run]"
    )
    return
  }
  const dryRun = args.has("--dry-run")
  const doCopy =
    args.has("--copy") ||
    (!args.has("--rewrite-db") && !args.has("--help"))
  const doRewrite = args.has("--rewrite-db")

  if (doCopy) {
    const res = await migrateBlobsToR2({
      dryRun,
      persistMapPath: defaultMapPath(),
      onProgress: (m) => console.log("  ", m),
    })
    console.log(
      `\nResumen copy: ${res.listed} listados, ${res.copied} copiados, ${res.skippedExisting} ya existían, ${res.errors} errores.`
    )
  }

  if (doRewrite) {
    let map: MigrationMap
    try {
      map = JSON.parse(await fs.readFile(defaultMapPath(), "utf8"))
    } catch {
      console.log("Mapa vacío. Ejecutá primero --copy.")
      return
    }
    const res = await rewriteDbUrls({
      map,
      dryRun,
      onProgress: (m) => console.log("  ", m),
    })
    console.log(
      `\nResumen rewrite-db${dryRun ? " (dry-run)" : ""}: ${res.scalarUpdated} filas escalares, ${res.jsonUpdated} filas JSON.`
    )
  }
}

main().catch((e) => {
  console.error("Fallo migración:", e)
  process.exit(1)
})
