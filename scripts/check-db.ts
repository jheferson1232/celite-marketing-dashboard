import "dotenv/config"
import {
  isUnreachableDatabaseUrl,
  formatChatDbError,
} from "../src/lib/chat/db-error"
import { pingChatDatabase } from "../src/lib/chat/chat-store"

const url = process.env.DATABASE_URL

if (isUnreachableDatabaseUrl(url)) {
  console.error(
    "DATABASE_URL apunta a localhost o está vacía. Usa Postgres en la nube para Vercel."
  )
  console.error("Guía: docs/DATABASE-VERCEL.md")
  process.exit(1)
}

try {
  await pingChatDatabase()
  console.log("OK: conexión a la base de datos correcta.")
} catch (error) {
  console.error("Error:", formatChatDbError(error))
  process.exit(1)
}
