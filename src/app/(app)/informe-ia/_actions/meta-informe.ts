"use server"

import { createServerAction } from "@/lib/server-action"
import { getMetaInformePayload } from "@/lib/services/meta/meta-operative-service"
import {
  buildMetaHourlyReportPayload,
  buildMetaHourlyTelegramMessage,
  sendMetaHourlyReportToTelegram,
} from "@/lib/services/meta/meta-hourly-report"

export const getMetaInformeAction = createServerAction(async () =>
  getMetaInformePayload()
)

export const syncMetaInformeAction = createServerAction(async () =>
  getMetaInformePayload()
)

/** Vista previa del informe horario (mismo texto que Telegram, sin enviar). */
export const previewMetaInformeHourlyAction = createServerAction(async () => {
  const informe = await getMetaInformePayload()
  const payload = await buildMetaHourlyReportPayload(informe)
  const text = await buildMetaHourlyTelegramMessage(payload)
  return {
    text,
    adsetsToPause: payload.adsetsToPause,
    campaignsToPause: payload.campaignsToPause,
  }
})

/** Envía el informe horario a los chats configurados en Telegram. */
export const sendMetaInformeHourlyToTelegramAction = createServerAction(
  async () => {
    const informe = await getMetaInformePayload()
    const payload = await buildMetaHourlyReportPayload(informe)
    const result = await sendMetaHourlyReportToTelegram(payload)
    return {
      text: result.message,
      sent: result.sent,
      adsetsToPause: result.adsetsToPause,
      campaignsToPause: result.campaignsToPause,
    }
  }
)

/** @deprecated Usar sendMetaInformeHourlyToTelegramAction */
export const getMetaInformeAiReminderAction = sendMetaInformeHourlyToTelegramAction
