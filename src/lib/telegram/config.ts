export function getTelegramBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN no está configurado")
  }
  return token
}

export function getTelegramWebhookSecret(): string | undefined {
  return process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || undefined
}

export function getAllowedTelegramUserIds(): Set<string> {
  const raw = process.env.TELEGRAM_ALLOWED_USER_IDS?.trim()
  if (!raw) return new Set()
  return new Set(
    raw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  )
}

export function isTelegramUserAllowed(telegramUserId: string): boolean {
  const allowed = getAllowedTelegramUserIds()
  if (allowed.size === 0) {
    console.warn(
      "TELEGRAM_ALLOWED_USER_IDS vacío: el bot acepta cualquier usuario. Configura IDs en producción."
    )
    return true
  }
  return allowed.has(telegramUserId)
}
