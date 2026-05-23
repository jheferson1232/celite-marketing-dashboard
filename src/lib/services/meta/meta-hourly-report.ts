import { getDashboardHour, getDashboardToday, getTodayDateRange } from "@/lib/date"
import {
  buildInformeCampaignSummaries,
  collectAdsetsCriticoActivos,
  collectAdsetsToPause,
  collectCampaignsToPause,
  type InformeCampaignSummary,
  type InformeCriticoActivoItem,
  type InformePauseItem,
} from "./meta-informe-alerts"
import { getAccountKpis } from "./account-kpis"
import {
  formatCop,
  getMetaInformePayload,
  type MetaInformePayload,
} from "./meta-operative-service"
import { claimMetaOnce } from "./meta-cache"
import { sendTelegramLongMessage } from "@/lib/telegram/bot"
import { getAllowedTelegramUserIds } from "@/lib/telegram/config"

export type { InformePauseItem as HourlyPauseItem, InformeCampaignSummary as HourlyCampaignSummary }

export type MetaHourlyReportPayload = {
  hour: number
  date: string
  accountSpend: number
  accountPurchases: number
  campaigns: InformeCampaignSummary[]
  /** Conjuntos ON con estado Crítico hoy (CPA &gt;20k o ≥10k sin compras). */
  adsetsCriticoActivos: InformeCriticoActivoItem[]
  adsetsToPause: InformePauseItem[]
  campaignsToPause: InformePauseItem[]
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
    adsetsCriticoActivos: collectAdsetsCriticoActivos(informe.groups),
    adsetsToPause: collectAdsetsToPause(informe.groups),
    campaignsToPause: collectCampaignsToPause(informe.groups),
  }
}

function formatCriticoActivoLine(item: InformeCriticoActivoItem): string {
  const base = `• **${item.name}** (${item.campaignName})`
  if (item.purchases > 0 && item.cpa > 0) {
    return `${base} · ${formatCop(item.spend)} · ${item.purchases} compra(s) · CPA ${formatCop(item.cpa)}`
  }
  return `${base} · ${formatCop(item.spend)} · 0 compras`
}

/** Solo conjuntos ON en Crítico (para revisar / desactivar). */
function buildHourlyCriticoTelegramBody(
  adsetsCriticoActivos: InformeCriticoActivoItem[]
): string {
  if (adsetsCriticoActivos.length === 0) {
    return "✅ Nada que revisar ahora."
  }

  return adsetsCriticoActivos.map(formatCriticoActivoLine).join("\n")
}

export async function buildMetaHourlyTelegramMessage(
  payload?: MetaHourlyReportPayload
): Promise<string> {
  const data = payload ?? (await buildMetaHourlyReportPayload())

  return (
    `📊 **Informe Meta ${data.hour}:00** (${data.date})\n\n` +
    buildHourlyCriticoTelegramBody(data.adsetsCriticoActivos)
  )
}

export async function sendMetaHourlyReportToTelegram(
  payload?: MetaHourlyReportPayload,
  options?: { skipDedup?: boolean }
): Promise<{
  message: string
  sent: number
  skippedDuplicate: boolean
  adsetsCriticoActivos: number
  adsetsToPause: number
  campaignsToPause: number
}> {
  const data = payload ?? (await buildMetaHourlyReportPayload())
  const message = await buildMetaHourlyTelegramMessage(data)

  const dedupKey = `meta-hourly-telegram:${data.date}:${data.hour}`
  if (
    !options?.skipDedup &&
    !claimMetaOnce(dedupKey, 55 * 60 * 1000)
  ) {
    console.info(`Meta hourly: ya enviado para ${data.date} h${data.hour}, omitiendo duplicado`)
    return {
      message,
      sent: 0,
      skippedDuplicate: true,
      adsetsCriticoActivos: data.adsetsCriticoActivos.length,
      adsetsToPause: data.adsetsToPause.length,
      campaignsToPause: data.campaignsToPause.length,
    }
  }

  const ids = getAllowedTelegramUserIds()

  if (ids.size === 0) {
    console.warn("Meta hourly: TELEGRAM_ALLOWED_USER_IDS vacío")
    return {
      message,
      sent: 0,
      skippedDuplicate: false,
      adsetsCriticoActivos: data.adsetsCriticoActivos.length,
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
    skippedDuplicate: false,
    adsetsCriticoActivos: data.adsetsCriticoActivos.length,
    adsetsToPause: data.adsetsToPause.length,
    campaignsToPause: data.campaignsToPause.length,
  }
}
