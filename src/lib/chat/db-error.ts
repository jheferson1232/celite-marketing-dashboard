import { ServerActionError } from "@/lib/server-action"

export function isUnreachableDatabaseUrl(url: string | undefined): boolean {
  if (!url?.trim()) return true
  return /localhost|127\.0\.0\.1/i.test(url)
}

export function formatChatDbError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : String(error ?? "Error desconocido")

  if (
    isUnreachableDatabaseUrl(process.env.DATABASE_URL) ||
    /ECONNREFUSED|Can't reach database|connection refused|connect ECONNREFUSED|localhost/i.test(
      message
    )
  ) {
    return (
      "No hay conexión a la base de datos en producción. " +
      "En Vercel → Settings → Environment Variables, configura DATABASE_URL con Postgres en la nube " +
      "(Neon, Supabase o Vercel Storage → Neon). Luego ejecuta: npm run db:push"
    )
  }

  if (/P1001|P1000|timeout|Timed out/i.test(message)) {
    return "La base de datos no responde. Revisa DATABASE_URL en Vercel y que el proyecto Neon/Supabase esté activo."
  }

  if (/P2021|does not exist|relation/i.test(message)) {
    return (
      "Faltan tablas en la base de datos. Ejecuta npm run db:push con la misma DATABASE_URL de producción."
    )
  }

  return message.trim() || "Error al acceder a la base de datos del asistente."
}

export function toChatDbServerError(error: unknown): ServerActionError {
  return new ServerActionError(formatChatDbError(error))
}
