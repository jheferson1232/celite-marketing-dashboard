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
  const secret = getTelegramWebhookSecret()
  if (secret) {
    const headerSecret = req.headers.get("x-telegram-bot-api-secret-token")
    if (headerSecret !== secret) {
      return new Response("Unauthorized", { status: 401 })
    }
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

/** GET: instrucciones para registrar el webhook (solo desarrollo). */
export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (!appUrl) {
    return Response.json({
      error:
        "Define NEXT_PUBLIC_APP_URL (ej. https://tu-app.vercel.app) para ver la URL del webhook.",
    })
  }

  const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/telegram/webhook`
  return Response.json({
    webhookUrl,
    setWebhook: `https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=${encodeURIComponent(webhookUrl)}`,
    note: "Configura TELEGRAM_WEBHOOK_SECRET y pásalo en setWebhook con secret_token=...",
  })
}
