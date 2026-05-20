import {
  answerTelegramCallbackQuery,
  editTelegramMessageReplyMarkup,
  sendTelegramMessage,
} from "./bot"
import { decodeCallback } from "./callback-data"
import {
  executeConfirmActivate,
  executeConfirmBudget,
  executeConfirmBudgetPercent,
  executeConfirmPause,
  executeConfirmPauseAdGroup,
  getBudgetPickerMessage,
  getConfirmActivateMessage,
  getConfirmPauseMessage,
  parseDateRangeArg,
} from "./tiktok-quick-actions"

export async function handleTelegramCallback(
  chatId: number,
  messageId: number,
  callbackQueryId: string,
  data: string
): Promise<void> {
  const action = decodeCallback(data)

  if (!action || action.type === "cancel") {
    await answerTelegramCallbackQuery(callbackQueryId, { text: "Cancelado" })
    await editTelegramMessageReplyMarkup(chatId, messageId)
    await sendTelegramMessage(chatId, "Acción cancelada.")
    return
  }

  const dateRange = parseDateRangeArg("hoy")

  try {
    switch (action.type) {
      case "select_pause": {
        const msg = await getConfirmPauseMessage(action.campaignId, dateRange)
        await answerTelegramCallbackQuery(callbackQueryId)
        await sendTelegramMessage(chatId, msg.text, {
          html: true,
          replyMarkup: { inline_keyboard: msg.keyboard },
        })
        return
      }

      case "select_activate": {
        const msg = await getConfirmActivateMessage(
          action.campaignId,
          dateRange
        )
        await answerTelegramCallbackQuery(callbackQueryId)
        await sendTelegramMessage(chatId, msg.text, {
          html: true,
          replyMarkup: { inline_keyboard: msg.keyboard },
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

      case "confirm_pause": {
        await answerTelegramCallbackQuery(callbackQueryId, {
          text: "Pausando…",
        })
        await editTelegramMessageReplyMarkup(chatId, messageId)
        const result = await executeConfirmPause(action.campaignId)
        await sendTelegramMessage(chatId, result, { html: true })
        return
      }

      case "confirm_activate": {
        await answerTelegramCallbackQuery(callbackQueryId, {
          text: "Activando…",
        })
        await editTelegramMessageReplyMarkup(chatId, messageId)
        const result = await executeConfirmActivate(action.campaignId)
        await sendTelegramMessage(chatId, result, { html: true })
        return
      }

      case "confirm_pause_adgroup": {
        await answerTelegramCallbackQuery(callbackQueryId, {
          text: "Pausando conjunto…",
        })
        await editTelegramMessageReplyMarkup(chatId, messageId)
        const result = await executeConfirmPauseAdGroup(action.adgroupId)
        await sendTelegramMessage(chatId, result, { html: true })
        return
      }

      case "confirm_budget": {
        await answerTelegramCallbackQuery(callbackQueryId, {
          text: "Guardando…",
        })
        await editTelegramMessageReplyMarkup(chatId, messageId)
        const result = await executeConfirmBudget(
          action.adgroupId,
          action.budget
        )
        await sendTelegramMessage(chatId, result, { html: true })
        return
      }

      case "confirm_budget_percent": {
        await answerTelegramCallbackQuery(callbackQueryId, {
          text: "Ajustando…",
        })
        await editTelegramMessageReplyMarkup(chatId, messageId)
        const result = await executeConfirmBudgetPercent(
          action.adgroupId,
          action.percent
        )
        await sendTelegramMessage(chatId, result, { html: true })
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
    await sendTelegramMessage(chatId, `❌ ${message}`)
  }
}
