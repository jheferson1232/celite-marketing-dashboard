// Server-only por convención (no importar desde componentes cliente).

import path from "node:path"
import fs from "node:fs/promises"
import { list } from "@vercel/blob"
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3"
import prisma from "@/lib/prisma"
import {
  buildR2PublicUrl,
  getR2BucketName,
  getR2Client,
} from "./client"

export type MigrationMapEntry = {
  oldUrl: string
  newUrl: string
  pathname: string
  size: number
  copied: boolean
  skippedExisting: boolean
  error?: string
}
export type MigrationMap = Record<string, MigrationMapEntry>

export type CopySummary = {
  listed: number
  copied: number
  skippedExisting: number
  errors: number
  map: MigrationMap
}

export type RewriteSummary = {
  scalarUpdated: number
  jsonUpdated: number
  details: string[]
}

const CONCURRENCY = 5
const LIST_LIMIT = 1000

function requiredEnv(name: string): string {
  const v = process.env[name]?.trim()
  if (!v) throw new Error(`Falta ${name} en .env / .env.local`)
  return v
}

async function r2Exists(
  key: string
): Promise<boolean> {
  const client = getR2Client()
  const bucket = getR2BucketName()
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return true
  } catch (err: unknown) {
    const code = (err as { name?: string })?.name
    const status = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata
      ?.httpStatusCode
    if (code === "NotFound" || status === 404) return false
    throw err
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  if (items.length === 0) return []
  const limit = Math.max(1, concurrency)
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (true) {
      const i = next++
      if (i >= items.length) break
      results[i] = await fn(items[i]!)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  )
  return results
}

export async function migrateBlobsToR2(options: {
  dryRun?: boolean
  persistMapPath?: string
  onProgress?: (msg: string) => void
}): Promise<CopySummary> {
  const dryRun = options.dryRun ?? false
  const token = requiredEnv("BLOB_READ_WRITE_TOKEN")
  const bucket = getR2BucketName()
  const client = getR2Client()
  const log = options.onProgress ?? (() => {})

  let existingMap: MigrationMap = {}
  if (options.persistMapPath) {
    try {
      existingMap = JSON.parse(
        await fs.readFile(options.persistMapPath, "utf8")
      ) as MigrationMap
    } catch {
      existingMap = {}
    }
  }

  const map: MigrationMap = { ...existingMap }
  let cursor: string | undefined
  let listed = 0
  let copied = 0
  let skippedExisting = 0
  let errors = 0

  log("Listando blobs de Vercel Blob...")
  while (true) {
    const res = await list({ cursor, limit: LIST_LIMIT, token })
    listed += res.blobs.length

    await mapWithConcurrency(
      res.blobs,
      async (blob) => {
        const oldUrl = blob.url
        const key = blob.pathname.replace(/^\/+/, "")

        const prev = map[oldUrl]
        if (prev?.copied) {
          skippedExisting++
          return
        }
        if (prev?.skippedExisting) {
          skippedExisting++
          return
        }

        try {
          const newUrl = buildR2PublicUrl(key)
          const exists = await r2Exists(key)
          if (exists) {
            map[oldUrl] = {
              oldUrl,
              newUrl,
              pathname: key,
              size: blob.size,
              copied: false,
              skippedExisting: true,
            }
            skippedExisting++
            return
          }

          if (dryRun) {
            log(`[dry-run] copiaría ${key} (${blob.size} bytes)`)
            map[oldUrl] = {
              oldUrl,
              newUrl,
              pathname: key,
              size: blob.size,
              copied: false,
              skippedExisting: false,
              error: "dry-run",
            }
            return
          }

          const dl = await fetch(blob.url, { redirect: "follow" })
          if (!dl.ok) throw new Error(`descarga HTTP ${dl.status}`)
          const buffer = Buffer.from(await dl.arrayBuffer())
          const contentType = dl.headers.get("content-type") ?? undefined

          await client.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: key,
              Body: buffer,
              ContentType: contentType ?? undefined,
            })
          )

          map[oldUrl] = {
            oldUrl,
            newUrl,
            pathname: key,
            size: blob.size,
            copied: true,
            skippedExisting: false,
          }
          copied++
          log(`copiado ${key} (${blob.size} bytes)`)
        } catch (err) {
          errors++
          const message = err instanceof Error ? err.message : String(err)
          log(`ERROR ${key}: ${message}`)
          map[oldUrl] = {
            oldUrl,
            newUrl: buildR2PublicUrl(key),
            pathname: key,
            size: blob.size,
            copied: false,
            skippedExisting: false,
            error: message,
          }
        }
      },
      CONCURRENCY
    )

    if (!res.hasMore || !res.cursor) break
    cursor = res.cursor
    if (options.persistMapPath) {
      await fs.writeFile(options.persistMapPath, JSON.stringify(map, null, 2))
    }
    log(`...parcial: ${listed} listados, ${copied} copiados, ${skippedExisting} preexistentes`)
  }

  if (options.persistMapPath) {
    await fs.writeFile(options.persistMapPath, JSON.stringify(map, null, 2))
  }

  return { listed, copied, skippedExisting, errors, map }
}

function replaceInJson(value: unknown, oldUrl: string, newUrl: string): unknown {
  if (typeof value === "string") {
    return value.includes(oldUrl) ? value.split(oldUrl).join(newUrl) : value
  }
  if (Array.isArray(value)) {
    let changed = false
    const next = value.map((v) => {
      const r = replaceInJson(v, oldUrl, newUrl)
      if (r !== v) changed = true
      return r
    })
    return changed ? next : value
  }
  if (value && typeof value === "object") {
    let changed = false
    const next: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const r = replaceInJson(v, oldUrl, newUrl)
      if (r !== v) changed = true
      next[k] = r
    }
    return changed ? next : value
  }
  return value
}

const SCALAR_COLUMNS: Array<{ model: keyof typeof prisma; column: string }> = [
  { model: "creative", column: "url" },
  { model: "metaCommentProduct", column: "imageUrl" },
  { model: "productPendingMatch", column: "previewUrl" },
]

const JSON_COLUMNS: Array<{ model: keyof typeof prisma; column: string }> = [
  { model: "productPendingMatch", column: "payload" },
  { model: "campaign", column: "config" },
]

export async function rewriteDbUrls(options: {
  map: MigrationMap
  dryRun?: boolean
  onProgress?: (msg: string) => void
}): Promise<RewriteSummary> {
  const dryRun = options.dryRun ?? false
  const log = options.onProgress ?? (() => {})
  const entries = Object.values(options.map).filter((e) => !e.error)
  const details: string[] = []

  if (entries.length === 0) {
    return { scalarUpdated: 0, jsonUpdated: 0, details }
  }

  let scalarUpdated = 0
  let jsonUpdated = 0

  log(`Reescribiendo ${entries.length} URLs en BD${dryRun ? " (dry-run)" : ""}...`)

  for (const { model, column } of SCALAR_COLUMNS) {
    const delegate = prisma[model] as unknown as {
      updateMany: (args: {
        where: Record<string, unknown>
        data: Record<string, unknown>
      }) => Promise<{ count: number }>
      count: (args: { where: Record<string, unknown> }) => Promise<number>
    }
    for (const e of entries) {
      if (dryRun) {
        const c = await delegate.count({ where: { [column]: e.oldUrl } })
        if (c > 0) {
          scalarUpdated += c
          const msg = `[dry-run] ${String(model)}.${column}: ${c} fila(s)`
          log(msg)
          details.push(msg)
        }
        continue
      }
      const res = await delegate.updateMany({
        where: { [column]: e.oldUrl },
        data: { [column]: e.newUrl },
      })
      if (res.count > 0) {
        scalarUpdated += res.count
        const msg = `${String(model)}.${column}: ${res.count} <- ${e.newUrl}`
        log(msg)
        details.push(msg)
      }
    }
  }

  for (const { model, column } of JSON_COLUMNS) {
    const delegate = prisma[model] as unknown as {
      findMany: (args: {
        select: Record<string, boolean>
      }) => Promise<Array<{ id: string } & Record<string, unknown>>>
      update: (args: {
        where: { id: string }
        data: Record<string, unknown>
      }) => Promise<unknown>
    }
    const rows = await delegate.findMany({
      select: { id: true, [column]: true },
    })
    for (const row of rows) {
      let next = row[column]
      let changed = false
      for (const e of entries) {
        const r = replaceInJson(next, e.oldUrl, e.newUrl)
        if (r !== next) {
          next = r
          changed = true
        }
      }
      if (!changed) continue
      if (dryRun) {
        jsonUpdated++
        const msg = `[dry-run] ${String(model)}.${column} id=${row.id}`
        log(msg)
        details.push(msg)
        continue
      }
      await delegate.update({ where: { id: row.id }, data: { [column]: next } })
      jsonUpdated++
      const msg = `${String(model)}.${column} id=${row.id} actualizado`
      log(msg)
      details.push(msg)
    }
  }

  return { scalarUpdated, jsonUpdated, details }
}

/** Ruta del archivo mapa por defecto (local). */
export function defaultMapPath(): string {
  return path.join(process.cwd(), "scripts", "r2-migration-map.json")
}
