/**
 * Configura CORS en el bucket Cloudflare R2 para permitir
 * subidas presignadas (PUT) desde el browser.
 *
 * Uso: pnpm r2:cors
 */
import {
  DeleteBucketCorsCommand,
  PutBucketCorsCommand,
  S3Client,
} from "@aws-sdk/client-s3"

const required = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
]

for (const name of required) {
  if (!process.env[name]?.trim()) {
    console.error(`Falta ${name} en el entorno.`)
    process.exit(1)
  }
}

const accountId = process.env.R2_ACCOUNT_ID.trim()
const bucket = process.env.R2_BUCKET_NAME.trim()

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://celite-marketing-dashboard.vercel.app",
  "https://celite-marketing-dashboard-chi.vercel.app",
  "https://celite-marketing-dashboard-jhefersoneusebio-gmailcoms-projects.vercel.app",
]

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID.trim(),
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY.trim(),
  },
})

try {
  await client.send(new DeleteBucketCorsCommand({ Bucket: bucket }))
} catch {
  // Sin CORS previo: ok
}

await client.send(
  new PutBucketCorsCommand({
    Bucket: bucket,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: allowedOrigins,
          AllowedMethods: ["GET", "PUT", "HEAD"],
          AllowedHeaders: ["*"],
          ExposeHeaders: ["ETag", "Content-Length", "Content-Type"],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  })
)

console.log(`CORS aplicado al bucket "${bucket}".`)
console.log("Orígenes permitidos:")
for (const origin of allowedOrigins) {
  console.log(`  - ${origin}`)
}
