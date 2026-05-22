import { getDashboardHour, getDashboardToday, getTodayDateRange } from "@/lib/date"
import {
  buildInformeCampaignSummaries,
  collectAdsetsToPause,
  collectCampaignsToPause,
  type InformeCampaignSummary,
  type InformePauseItem,
} from "./meta-informe-alerts"
import { getAccountKpis } from "./account-kpis"
import {
  formatCop,
  getMetaInformePayload,
  mapOlvidoNotificationsFromInforme,
  type MetaInformePayload,
  type OlvidoNotificationItem,
} from "./meta-operative-service"
import { generateHourlyOperativeCommentary } from "./meta-cron-commentary"
import { sendTelegramLongMessage } from "@/lib/telegram/bot"
import { getAllowedTelegramUserIds } from "@/lib/telegram/config"

export type { InformePauseItem as HourlyPauseItem, InformeCampaignSummary as HourlyCampaignSummary }

export type MetaHourlyReportPayload = {
  hour: number
  date: string
  accountSpend: number
  accountPurchases: number
  campaigns: InformeCampaignSummary[]
  adsetsToPause: InformePauseItem[]
  campaignsToPause: InformePauseItem[]
  olvido: OlvidoNotificationItem[]
}

/** Una sola sync de informe; opcionalmente reutiliza payload ya cargado. */
export async function buildMetaHourlyReportPayload(
  cachedInforme?: MetaInformePayload
): Promise<MetaHourlyReportPayload> {
  const [informe, kpis] = await Promise.all([
    cachedInforme ?? getMetaInformePayload(),
    getAccountKpis(getTodayDateRange()),
  ])

  return {
    hour: getDashboardHour(),
    date: getDashboardToday(),
    accountSpend: kpis.totalSpend,
    accountPurchases: kpis.purchases,
    campaigns: buildInformeCampaignSummaries(informe.groups),
    adsetsToPause: collectAdsetsToPause(informe.groups),
    campaignsToPause: collectCampaignsToPause(informe.groups),
    olvido: mapOlvidoNotificationsFromInforme(informe),
  }
}

export async function buildMetaHourlyTelegramMessage(
  payload?: MetaHourlyReportPayload
): Promise<string> {
  const data = payload ?? (await buildMetaHourlyReportPayload())
  const body = await generateHourlyOperativeCommentary(data)

  return (
    `📊 **Informe Meta ${data.hour}:00** (${data.date})\n\n` +
    `💰 Cuenta hoy: **${formatCop(data.accountSpend)}** · **${data.accountPurchases}** compras\n\n` +
    body
  )
}

export async function sendMetaHourlyReportToTelegram(
  payload?: MetaHourlyReportPayload
): Promise<{
  message: string
  sent: number
  adsetsToPause: number
  campaignsToPause: number
}> {
  const data = payload ?? (await buildMetaHourlyReportPayload())
  const message = await buildMetaHourlyTelegramMessage(data)
  const ids = getAllowedTelegramUserIds()

  if (ids.size === 0) {
    console.warn("Meta hourly: TELEGRAM_ALLOWED_USER_IDS vacío")
    return {
      message,
      sent: 0,
      adsetsToPause: data.adsetsToPause.length,
      campaignsToPause: data.campaignsToPause.length,
    }
  }

  let sent = 0
  for (const chatId of ids) {
    try {
      await sendTelegramLongMessage(chatId, message, { html: true })
      sent += 1
    } catch (error) {
      console.error(`Meta hourly Telegram chat ${chatId}:`, error)
    }
  }

  return {
    message,
    sent,
    adsetsToPause: data.adsetsToPause.length,
    campaignsToPause: data.campaignsToPause.length,
  }
}
