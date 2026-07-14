// Server-only por convención (no importar desde componentes cliente).

import {
  DeleteObjectCommand,
  PutObjectCommand,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import {
  buildR2PublicUrl,
  getR2BucketName,
  getR2Client,
} from "./client"
import { extractR2KeyFromUrl } from "@/lib/services/blob/managed-media-url"

type PutOptions = {
  contentType?: string
  cacheControl?: string
  metadata?: Record<string, string>
}

/** Sube un objeto al bucket y devuelve su URL pública. */
export async function putR2Object(
  key: string,
  body: PutObjectCommandInput["Body"],
  options: PutOptions = {}
): Promise<string> {
  const client = getR2Client()
  const bucket = getR2BucketName()

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: options.contentType,
      CacheControl: options.cacheControl,
      Metadata: options.metadata,
    })
  )

  return buildR2PublicUrl(key)
}

/** Elimina un objeto. Acepta la URL pública o el key directo. No falla si no existe. */
export async function deleteR2Object(urlOrKey: string): Promise<void> {
  const key = extractR2KeyFromUrl(urlOrKey) ?? urlOrKey.replace(/^\/+/, "")
  if (!key) return

  const client = getR2Client()
  const bucket = getR2BucketName()

  await client
    .send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    .catch((error) => {
      console.error("No se pudo eliminar objeto R2:", key, error)
    })
}

/** Genera una URL presignada para subir un objeto desde el browser. */
export async function presignR2Upload(
  key: string,
  options: { contentType?: string; expiresIn?: number }
): Promise<string> {
  const client = getR2Client()
  const bucket = getR2BucketName()

  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: options.contentType,
    }),
    { expiresIn: options.expiresIn ?? 60 }
  )
}
