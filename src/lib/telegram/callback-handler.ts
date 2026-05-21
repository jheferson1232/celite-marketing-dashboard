import {
  answerTelegramCallbackQuery,
  editTelegramMessageReplyMarkup,
  sendTelegramMessage,
} from "./bot"
import { getTelegramReplyKeyboard } from "./keyboards"
import { decodeCallback, type CallbackAction } from "./callback-data"
import {
  executeConfirmActivate,
  executeConfirmBudget,
  executeConfirmBudgetPercent,
  executeConfirmPause,
  executeConfirmPauseAdGroup,
  getBudgetPickerMessage,
  parseDateRangeArg,
} from "./tiktok-quick-actions"

async function runConfirmAction(action: CallbackAction): Promise<string> {
  switch (action.type) {
    case "confirm_pause":
      return executeConfirmPause(action.campaignId)
    case "confirm_activate":
      return executeConfirmActivate(action.campaignId)
    case "confirm_pause_adgroup":
      return executeConfirmPauseAdGroup(action.adgroupId)
    case "confirm_budget":
      return executeConfirmBudget(action.adgroupId, action.budget)
    case "confirm_budget_percent":
      return executeConfirmBudgetPercent(action.adgroupId, action.percent)
    default:
      throw new Error("Acción no ejecutable")
  }
}

export async function handleTelegramCallback(
  _telegramUserId: string,
  chatId: number,
  messageId: number,
  callbackQueryId: string,
  data: string
): Promise<void> {
  const action = decodeCallback(data)

  if (!action || action.type === "cancel") {
    await answerTelegramCallbackQuery(callbackQueryId, { text: "Cancelado" })
    await editTelegramMessageReplyMarkup(chatId, messageId)
    await sendTelegramMessage(chatId, "Acción cancelada.", {
      replyMarkup: getTelegramReplyKeyboard(),
    })
    return
  }

  const dateRange = parseDateRangeArg("hoy")

  try {
    switch (action.type) {
      case "select_pause": {
        await answerTelegramCallbackQuery(callbackQueryId, { text: "Pausando…" })
        const result = await executeConfirmPause(action.campaignId)
        await sendTelegramMessage(chatId, result, {
          html: true,
          replyMarkup: getTelegramReplyKeyboard(),
        })
        return
      }

      case "select_activate": {
        await answerTelegramCallbackQuery(callbackQueryId, { text: "Activando…" })
        const result = await executeConfirmActivate(action.campaignId)
        await sendTelegramMessage(chatId, result, {
          html: true,
          replyMarkup: getTelegramReplyKeyboard(),
        })
        return
      }

      case "select_pause_adgroup": {
        await answerTelegramCallbackQuery(callbackQueryId, { text: "Pausando…" })
        const result = await executeConfirmPauseAdGroup(action.adgroupId)
        await sendTelegramMessage(chatId, result, {
          html: true,
          replyMarkup: getTelegramReplyKeyboard(),
        })
        return
      }

      case "select_budget": {
        const msg = await getBudgetPickerMessage(action.adgroupId, dateRange)
        await answerTelegramCallbackQuery(callbackQueryId)
        await sendTelegramMessage(chatId, msg.text, {
          html: true,
          replyMarkup: { inline_keyboard: msg.keyboard },
        })
        return
      }

      case "confirm_pause":
      case "confirm_activate":
      case "confirm_pause_adgroup":
      case "confirm_budget":
      case "confirm_budget_percent": {
        await answerTelegramCallbackQuery(callbackQueryId, {
          text: "Aplicando…",
        })
        await editTelegramMessageReplyMarkup(chatId, messageId)
        const result = await runConfirmAction(action)
        await sendTelegramMessage(chatId, result, {
          html: true,
          replyMarkup: getTelegramReplyKeyboard(),
        })
        return
      }
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al ejecutar la acción"
    await answerTelegramCallbackQuery(callbackQueryId, {
      text: message.slice(0, 180),
      showAlert: true,
    })
    await sendTelegramMessage(chatId, `❌ ${message}`, {
      replyMarkup: getTelegramReplyKeyboard(),
    })
  }
}
