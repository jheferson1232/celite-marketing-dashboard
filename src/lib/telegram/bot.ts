import { formatAssistantReplyForTelegram } from "./format-message"
import { getTelegramBotToken } from "./config"

const TELEGRAM_API = "https://api.telegram.org"

export type InlineKeyboardButton = {
  text: string
  callback_data: string
}

export type ReplyKeyboardMarkup = {
  keyboard: { text: string }[][]
  resize_keyboard?: boolean
  is_persistent?: boolean
  one_time_keyboard?: boolean
}

export type ReplyKeyboardRemove = {
  remove_keyboard: true
}

export type TelegramReplyMarkup =
  | { inline_keyboard: InlineKeyboardButton[][] }
  | ReplyKeyboardMarkup
  | ReplyKeyboardRemove

async function telegramApiCall<T>(
  method: string,
  payload: Record<string, unknown>
): Promise<T> {
  const token = getTelegramBotToken()
  const response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Telegram ${method} failed: ${response.status} ${body}`)
  }

  return response.json() as Promise<T>
}

export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  options?: {
    html?: boolean
    skipFormat?: boolean
    replyMarkup?: TelegramReplyMarkup
  }
): Promise<void> {
  const useHtml = options?.html ?? false
  const body =
    useHtml && !options?.skipFormat
      ? formatAssistantReplyForTelegram(text)
      : text
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text: body,
    disable_web_page_preview: true,
  }
  if (useHtml) {
    payload.parse_mode = "HTML"
  }
  if (options?.replyMarkup) {
    payload.reply_markup = options.replyMarkup
  }

  await telegramApiCall("sendMessage", payload)
}

export async function answerTelegramCallbackQuery(
  callbackQueryId: string,
  options?: { text?: string; showAlert?: boolean }
): Promise<void> {
  await telegramApiCall("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text: options?.text,
    show_alert: options?.showAlert ?? false,
  })
}

export async function editTelegramMessageReplyMarkup(
  chatId: number,
  messageId: number,
  replyMarkup?: TelegramReplyMarkup
): Promise<void> {
  await telegramApiCall("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: replyMarkup ?? { inline_keyboard: [] },
  })
}

export function splitTelegramMessage(
  text: string,
  maxLength = 4096
): string[] {
  if (text.length <= maxLength) return [text]

  const chunks: string[] = []
  let remaining = text

  while (remaining.length > maxLength) {
    let splitAt = remaining.lastIndexOf("\n\n", maxLength)
    if (splitAt < maxLength * 0.4) {
      splitAt = remaining.lastIndexOf("\n", maxLength)
    }
    if (splitAt < maxLength * 0.4) {
      splitAt = maxLength
    }
    chunks.push(remaining.slice(0, splitAt).trimEnd())
    remaining = remaining.slice(splitAt).trimStart()
  }

  if (remaining.length > 0) chunks.push(remaining)
  return chunks
}

export async function sendTelegramLongMessage(
  chatId: number | string,
  text: string,
  options?: { html?: boolean; replyMarkup?: TelegramReplyMarkup }
): Promise<void> {
  const body = options?.html ? formatAssistantReplyForTelegram(text) : text
  const parts = splitTelegramMessage(body)
  for (let i = 0; i < parts.length; i++) {
    await sendTelegramMessage(chatId, parts[i]!, {
      html: options?.html,
      skipFormat: true,
      replyMarkup: i === parts.length - 1 ? options?.replyMarkup : undefined,
    })
  }
}

/** Respuesta del asistente IA: HTML + solo métricas permitidas. */
export async function sendTelegramAssistantReply(
  chatId: number | string,
  text: string
): Promise<void> {
  await sendTelegramLongMessage(chatId, text, { html: true })
}
