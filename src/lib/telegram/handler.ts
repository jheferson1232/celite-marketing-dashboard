import type { ChatPlatform } from "@/lib/chat/kpi-response"
import { askAssistant } from "@/lib/chat/assistant"
import {
  getOrCreateTelegramSession,
  inferPlatformFromText,
  resetTelegramSession,
  setTelegramPlatform,
} from "@/lib/chat/telegram-session"
import {
  answerTelegramCallbackQuery,
  sendTelegramAssistantReply,
  sendTelegramMessage,
  splitTelegramMessage,
  type InlineKeyboardButton,
} from "./bot"
import { handleTelegramCallback } from "./callback-handler"
import { isTelegramUserAllowed } from "./config"
import { formatCombinedSpendMessage } from "./combined-spend-message"
import {
  formatMetaActiveCampaignsMessage,
  parseMetaDateRangeArg,
} from "./meta-quick-actions"
import {
  getTelegramReplyKeyboard,
  isReplyShortcutText,
  REPLY_SHORTCUT,
  type ReplyShortcutText,
} from "./keyboards"
import {
  buildAdGroupBudgetPickerKeyboard,
  buildAdGroupPausePickerKeyboard,
  buildCampaignPickerKeyboard,
  formatTikTokActiveCampaignsMessage,
  formatTikTokCampaignsMessage,
  parseDateRangeArg,
  activateCampaignByNameQuery,
  pauseAdGroupByNameQuery,
  pauseCampaignByNameQuery,
  setAdGroupBudgetByQuery,
} from "./tiktok-quick-actions"

type TelegramUser = {
  id: number
  first_name?: string
  username?: string
}

type TelegramMessage = {
  message_id: number
  chat: { id: number }
  from?: TelegramUser
  text?: string
}

type TelegramCallbackQuery = {
  id: string
  from: TelegramUser
  message?: TelegramMessage
  data?: string
}

export type TelegramUpdate = {
  update_id: number
  message?: TelegramMessage
  callback_query?: TelegramCallbackQuery
}

const HELP_TEXT = `**Comandos**
/start — Inicio + teclado
/ayuda — Esta ayuda
/nuevo — Nueva conversación
/gasto — Gasto Facebook + TikTok (hoy)
/gasto ayer — Gasto Facebook + TikTok (ayer)
/tiktok — Modo TikTok (PEN)
/meta — Modo Meta (COP)

**TikTok — acciones**
/pausar — Pausar campaña (elige o nombre)
/pausarconjunto — Pausar conjunto activo
/activar — Activar campaña
/presupuesto — Subir presupuesto de conjunto

**Teclado**
📊 Gasto total hoy · 📅 Gasto total ayer
📘 FB campañas activas · 🎵 TT campañas activas

También puedes escribir en español y el asistente responderá.`

function getCommand(text: string): string | null {
  const match = text.trim().match(/^\/([a-z0-9_]+)(?:@\w+)?(?:\s|$)/i)
  return match ? match[1].toLowerCase() : null
}

function getCommandArgs(text: string): string {
  return text.replace(/^\/[a-z0-9_]+(?:@\w+)?\s*/i, "").trim()
}

async function sendTikTokActionResult(
  chatId: number,
  result: { text: string; keyboard?: InlineKeyboardButton[][] }
): Promise<void> {
  await sendTelegramMessage(chatId, result.text, {
    html: true,
    replyMarkup: result.keyboard
      ? { inline_keyboard: result.keyboard }
      : getTelegramReplyKeyboard(),
  })
}

async function sendWithReplyKeyboard(
  chatId: number,
  text: string,
  options?: { html?: boolean }
): Promise<void> {
  const keyboard = getTelegramReplyKeyboard()
  const parts = splitTelegramMessage(text)

  for (let i = 0; i < parts.length; i++) {
    await sendTelegramMessage(chatId, parts[i]!, {
      html: options?.html,
      replyMarkup: i === parts.length - 1 ? keyboard : undefined,
    })
  }
}

async function handleShortcut(
  chatId: number,
  shortcut: ReplyShortcutText
): Promise<void> {
  switch (shortcut) {
    case REPLY_SHORTCUT.GASTO_HOY: {
      const text = await formatCombinedSpendMessage(
        parseDateRangeArg("hoy"),
        "hoy"
      )
      await sendWithReplyKeyboard(chatId, text, { html: true })
      return
    }
    case REPLY_SHORTCUT.GASTO_AYER: {
      const text = await formatCombinedSpendMessage(
        parseDateRangeArg("ayer"),
        "ayer"
      )
      await sendWithReplyKeyboard(chatId, text, { html: true })
      return
    }
    case REPLY_SHORTCUT.FB_ACTIVAS: {
      const range = parseMetaDateRangeArg("hoy")
      const text = await formatMetaActiveCampaignsMessage(range, "hoy")
      await sendWithReplyKeyboard(chatId, text, { html: true })
      return
    }
    case REPLY_SHORTCUT.TT_ACTIVAS: {
      const range = parseDateRangeArg("hoy")
      const text = await formatTikTokActiveCampaignsMessage(range, "hoy")
      await sendWithReplyKeyboard(chatId, text, { html: true })
      return
    }
  }
}

async function handleCommand(
  telegramUserId: string,
  chatId: number,
  command: string,
  args: string
): Promise<void> {
  switch (command) {
    case "start":
      await getOrCreateTelegramSession(telegramUserId)
      await setTelegramPlatform(telegramUserId, "tiktok")
      await sendWithReplyKeyboard(
        chatId,
        `Hola. Soy tu asistente de marketing (Meta + TikTok).\n\n${HELP_TEXT}`,
        { html: true }
      )
      return

    case "ayuda":
    case "help":
      await sendWithReplyKeyboard(chatId, HELP_TEXT, { html: true })
      return

    case "nuevo":
    case "new": {
      const session = await resetTelegramSession(telegramUserId, "tiktok")
      await sendWithReplyKeyboard(
        chatId,
        `Conversación nueva. Plataforma: ${session.platform === "tiktok" ? "TikTok" : "Meta"}.\n\n${HELP_TEXT}`,
        { html: true }
      )
      return
    }

    case "meta": {
      await setTelegramPlatform(telegramUserId, "meta")
      await sendTelegramMessage(
        chatId,
        "Listo. Consultaré Meta Ads (COP) por defecto."
      )
      if (args) await handleQuestion(telegramUserId, chatId, args, "meta")
      return
    }

    case "tiktok": {
      await setTelegramPlatform(telegramUserId, "tiktok")
      await sendWithReplyKeyboard(
        chatId,
        "Listo. **TikTok Ads** (soles PEN). Usa los botones o /gasto, /campanas, /pausar.",
        { html: true }
      )
      if (args) await handleQuestion(telegramUserId, chatId, args, "tiktok")
      return
    }

    case "gasto": {
      const range = parseDateRangeArg(args || "hoy")
      const label = args?.trim() || "hoy"
      const text = await formatCombinedSpendMessage(range, label)
      await sendWithReplyKeyboard(chatId, text, { html: true })
      return
    }

    case "campanas":
    case "campañas":
    case "campaigns": {
      await setTelegramPlatform(telegramUserId, "tiktok")
      const text = await formatTikTokCampaignsMessage(parseDateRangeArg("hoy"))
      await sendWithReplyKeyboard(chatId, text, { html: true })
      return
    }

    case "pausar": {
      await setTelegramPlatform(telegramUserId, "tiktok")
      if (!args) {
        const keyboard = await buildCampaignPickerKeyboard(
          "pause",
          parseDateRangeArg("hoy")
        )
        await sendTelegramMessage(chatId, "Elige la **campaña** a pausar:", {
          html: true,
          replyMarkup: { inline_keyboard: keyboard },
        })
        return
      }
      await sendTikTokActionResult(chatId, await pauseCampaignByNameQuery(args))
      return
    }

    case "pausarconjunto":
    case "pausar_conjunto": {
      await setTelegramPlatform(telegramUserId, "tiktok")
      if (!args) {
        const keyboard = await buildAdGroupPausePickerKeyboard(
          parseDateRangeArg("hoy")
        )
        await sendTelegramMessage(chatId, "Elige el **conjunto** a pausar:", {
          html: true,
          replyMarkup: { inline_keyboard: keyboard },
        })
        return
      }
      await sendTikTokActionResult(chatId, await pauseAdGroupByNameQuery(args))
      return
    }

    case "activar": {
      await setTelegramPlatform(telegramUserId, "tiktok")
      if (!args) {
        const keyboard = await buildCampaignPickerKeyboard(
          "activate",
          parseDateRangeArg("hoy")
        )
        await sendTelegramMessage(chatId, "Elige la **campaña** a activar:", {
          html: true,
          replyMarkup: { inline_keyboard: keyboard },
        })
        return
      }
      await sendTikTokActionResult(chatId, await activateCampaignByNameQuery(args))
      return
    }

    case "presupuesto": {
      await setTelegramPlatform(telegramUserId, "tiktok")
      const parts = args.split(/\s+/)
      if (parts.length < 2) {
        const { text, keyboard } = await buildAdGroupBudgetPickerKeyboard(
          parseDateRangeArg("hoy")
        )
        await sendTelegramMessage(chatId, text, {
          html: true,
          replyMarkup: { inline_keyboard: keyboard },
        })
        return
      }
      const budget = Number(parts[parts.length - 1]?.replace(",", "."))
      const nameQuery = parts.slice(0, -1).join(" ")
      if (!Number.isFinite(budget) || budget <= 0) {
        await sendTelegramMessage(
          chatId,
          "Uso: /presupuesto &lt;nombre conjunto&gt; &lt;monto&gt;\nEj: /presupuesto negro bid 12 40"
        )
        return
      }
      await sendTikTokActionResult(
        chatId,
        await setAdGroupBudgetByQuery(nameQuery, budget)
      )
      return
    }

    default:
      await sendTelegramMessage(
        chatId,
        `Comando desconocido. Usa /ayuda.\n\n${HELP_TEXT}`,
        { html: true }
      )
  }
}

/** Frases en español → acciones TikTok sin pasar por el asistente. */
async function handleNaturalTikTokAction(
  chatId: number,
  text: string
): Promise<boolean> {
  const normalized = text.trim()

  const pauseAdGroup = normalized.match(
    /^(?:apagar|pausar|desactivar)\s+(?:el\s+)?(?:conjunto\s+)?(.+)$/i
  )
  if (pauseAdGroup?.[1]) {
    await sendTikTokActionResult(
      chatId,
      await pauseAdGroupByNameQuery(pauseAdGroup[1].trim())
    )
    return true
  }

  const pauseCampaign = normalized.match(
    /^(?:apagar|pausar|desactivar)\s+(?:la\s+)?campa(?:ñ|n)a\s+(.+)$/i
  )
  if (pauseCampaign?.[1]) {
    await sendTikTokActionResult(
      chatId,
      await pauseCampaignByNameQuery(pauseCampaign[1].trim())
    )
    return true
  }

  const activateCampaign = normalized.match(
    /^(?:activar|encender|prender)\s+(?:la\s+)?campa(?:ñ|n)a\s+(.+)$/i
  )
  if (activateCampaign?.[1]) {
    await sendTikTokActionResult(
      chatId,
      await activateCampaignByNameQuery(activateCampaign[1].trim())
    )
    return true
  }

  const budgetMatch = normalized.match(
    /^(?:presupuesto|sube?\s+presupuesto|pon(?:er)?)\s+(.+?)\s+(?:a\s+|en\s+)?(?:s\/?\s*)?(\d+(?:[.,]\d+)?)\s*$/i
  )
  if (budgetMatch?.[1] && budgetMatch[2]) {
    const budget = Number(budgetMatch[2].replace(",", "."))
    if (Number.isFinite(budget) && budget > 0) {
      await sendTikTokActionResult(
        chatId,
        await setAdGroupBudgetByQuery(budgetMatch[1].trim(), budget)
      )
      return true
    }
  }

  return false
}

async function handleQuestion(
  telegramUserId: string,
  telegramChatId: number,
  question: string,
  platformOverride?: ChatPlatform
): Promise<void> {
  const session = await getOrCreateTelegramSession(telegramUserId)
  const platform =
    platformOverride ??
    inferPlatformFromText(
      question,
      (session.platform as ChatPlatform) || "meta"
    )

  await sendTelegramMessage(telegramChatId, "Consultando datos…")

  try {
    const reply = await askAssistant({
      userText: question,
      chatId: session.chatId,
      platform,
      channel: "telegram",
    })
    await sendTelegramAssistantReply(telegramChatId, reply)
  } catch (error) {
    console.error("Telegram assistant error:", error)
    await sendTelegramMessage(
      telegramChatId,
      "Hubo un error al consultar los datos. Intenta de nuevo en unos segundos."
    )
  }
}

async function handleCallbackQuery(
  update: TelegramUpdate
): Promise<void> {
  const query = update.callback_query
  if (!query?.from || !query.data) return

  const telegramUserId = String(query.from.id)
  if (!isTelegramUserAllowed(telegramUserId)) {
    await answerTelegramCallbackQuery(query.id, {
      text: "Sin permiso",
      showAlert: true,
    })
    return
  }

  const chatId = query.message?.chat.id
  const messageId = query.message?.message_id
  if (chatId == null || messageId == null) {
    await answerTelegramCallbackQuery(query.id, {
      text: "Mensaje no disponible",
    })
    return
  }

  await handleTelegramCallback(
    telegramUserId,
    chatId,
    messageId,
    query.id,
    query.data
  )
}

export async function processTelegramUpdate(
  update: TelegramUpdate
): Promise<void> {
  if (update.callback_query) {
    await handleCallbackQuery(update)
    return
  }

  const message = update.message
  if (!message?.from || !message.text?.trim()) return

  const telegramUserId = String(message.from.id)
  const telegramChatId = message.chat.id
  const text = message.text.trim()

  if (!isTelegramUserAllowed(telegramUserId)) {
    await sendTelegramMessage(
      telegramChatId,
      "No tienes permiso para usar este bot."
    )
    return
  }

  if (isReplyShortcutText(text)) {
    await handleShortcut(telegramChatId, text)
    return
  }

  const command = getCommand(text)
  if (command) {
    await handleCommand(telegramUserId, telegramChatId, command, getCommandArgs(text))
    return
  }

  if (await handleNaturalTikTokAction(telegramChatId, text)) {
    return
  }

  await handleQuestion(telegramUserId, telegramChatId, text)
}
