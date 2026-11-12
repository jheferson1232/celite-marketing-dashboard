import { after } from "next/server"
import {
  getTelegramWebhookSecret,
  isTelegramUserAllowed,
} from "@/lib/telegram/config"
import {
  processTelegramUpdate,
  type TelegramUpdate,
} from "@/lib/telegram/handler"

export const maxDuration = 60

export async function POST(req: Request) {
  // Ruta pública (fuera del login): sin secreto configurado no se acepta nada.
  const secret = getTelegramWebhookSecret()
  if (!secret) {
    console.error("Telegram webhook: falta TELEGRAM_WEBHOOK_SECRET")
    return new Response("Webhook no configurado", { status: 503 })
  }
  const headerSecret = req.headers.get("x-telegram-bot-api-secret-token")
  if (headerSecret !== secret) {
    return new Response("Unauthorized", { status: 401 })
  }

  let update: TelegramUpdate
  try {
    update = (await req.json()) as TelegramUpdate
  } catch {
    return new Response("Bad Request", { status: 400 })
  }

  const telegramUserId = update.message?.from?.id
  if (
    telegramUserId &&
    !isTelegramUserAllowed(String(telegramUserId))
  ) {
    return Response.json({ ok: true })
  }

  after(async () => {
    try {
      await processTelegramUpdate(update)
    } catch (error) {
      console.error("Telegram webhook processing error:", error)
    }
  })

  return Response.json({ ok: true })
}
