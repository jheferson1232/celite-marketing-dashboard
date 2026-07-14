import { config } from "dotenv"
config({ path: ".env.local" })

import { S3Client } from "@aws-sdk/client-s3"
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

function required(name: string): string {
  const v = process.env[name]?.trim()
  if (!v) throw new Error(`Falta ${name}`)
  return v
}

const accountId = required("R2_ACCOUNT_ID")
const accessKeyId = required("R2_ACCESS_KEY_ID")
const secretAccessKey = required("R2_SECRET_ACCESS_KEY")
const bucket = required("R2_BUCKET_NAME")
const publicBase = required("NEXT_PUBLIC_R2_PUBLIC_BASE_URL").replace(/\/$/, "")

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
})

function publicUrl(key: string) {
  return `${publicBase}/${key.replace(/^\/+/, "")}`
}

async function main() {
  const key = `_r2-test/${Date.now()}-hola.txt`
  const body = "Hola R2 — prueba de migracion celite OK"

  console.log("-> PUT directo via S3 API...")
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "text/plain; charset=utf-8",
    })
  )
  const url = publicUrl(key)
  console.log("   URL publica:", url)

  console.log("-> Verificando acceso publico (fetch anonimo)...")
  const res = await fetch(url, { redirect: "follow" })
  const text = await res.text()
  console.log("   status:", res.status, "| body coincide:", text === body)
  if (text !== body) {
    console.error("   body recibido:", text.slice(0, 200))
    throw new Error("Body publico no coincide")
  }

  console.log("-> GET via presigned URL...")
  const getSigned = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 30 }
  )
  const r2 = await fetch(getSigned)
  const t2 = await r2.text()
  console.log("   status:", r2.status, "| body coincide:", t2 === body)

  console.log("-> Presigned PUT (simula upload browser)...")
  const putKey = `${key}.put`
  const putSigned = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: putKey,
      ContentType: "text/plain; charset=utf-8",
    }),
    { expiresIn: 60 }
  )
  const pr = await fetch(putSigned, {
    method: "PUT",
    headers: { "Content-Type": "text/plain; charset=utf-8" },
    body: "subido via presigned PUT",
  })
  console.log("   PUT status:", pr.status)
  const pv = await fetch(publicUrl(putKey))
  const pt = await pv.text()
  console.log("   PUT publico body coincide:", pt === "subido via presigned PUT")

  console.log("-> Borrando objetos de prueba...")
  for (const k of [key, putKey]) {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: k }))
  }
  console.log("OK - R2 configurado correctamente.")
}

main().catch((e) => {
  console.error("Fallo:", e)
  process.exit(1)
})
