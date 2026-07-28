// Server-only por convención (no importar desde componentes cliente).
// Para helpers client-safe ver src/lib/services/blob/managed-media-url.ts

import { S3Client } from "@aws-sdk/client-s3"

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(
      `Falta ${name}. Configurá las credenciales de Cloudflare R2 en .env.`
    )
  }
  return value
}

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID?.trim() &&
      process.env.R2_ACCESS_KEY_ID?.trim() &&
      process.env.R2_SECRET_ACCESS_KEY?.trim() &&
      process.env.R2_BUCKET_NAME?.trim()
  )
}

export function assertR2Configured(): void {
  if (!isR2Configured()) {
    throw new Error(
      "Cloudflare R2 no está configurado. Añadí R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY y R2_BUCKET_NAME en .env."
    )
  }
}

/** URL pública base para construir las URLs de los objetos (custom domain). */
export function getR2PublicBaseUrl(): string {
  const raw = (
    process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ??
    process.env.R2_PUBLIC_BASE_URL ??
    ""
  ).trim()
  if (!raw) {
    throw new Error(
      "R2_PUBLIC_BASE_URL no configurado. Conectá un custom domain al bucket en Cloudflare y guardá su URL base en .env (NEXT_PUBLIC_R2_PUBLIC_BASE_URL)."
    )
  }
  return raw.replace(/\/$/, "")
}

function getR2Endpoint(): string {
  const accountId = requiredEnv("R2_ACCOUNT_ID")
  return `https://${accountId}.r2.cloudflarestorage.com`
}

let cached: S3Client | null = null

/** Cliente S3 apuntando a R2. Singleton a nivel de módulo. */
export function getR2Client(): S3Client {
  if (cached) return cached

  assertR2Configured()
  cached = new S3Client({
    region: "auto",
    endpoint: getR2Endpoint(),
    credentials: {
      accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    },
    // Evita query params de checksum que rompen PUT presignado desde el browser.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  })
  return cached
}

export function getR2BucketName(): string {
  return requiredEnv("R2_BUCKET_NAME")
}

/** Construye la URL pública de un objeto a partir de su key. */
export function buildR2PublicUrl(key: string): string {
  const base = getR2PublicBaseUrl()
  const normalizedKey = key.replace(/^\/+/, "")
  return `${base}/${normalizedKey}`
}
