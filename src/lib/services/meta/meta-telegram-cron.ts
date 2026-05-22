import {
  getDashboardHour,
  getDashboardToday,
  getTodayDateRange,
} from "@/lib/date"
import { getAllowedTelegramUserIds } from "@/lib/telegram/config"
import { sendTelegramLongMessage } from "@/lib/telegram/bot"
import { getAccountKpis } from "./account-kpis"
import { formatCop, getMetaInformePayload } from "./meta-operative-service"
import { generateNightlyCommentary } from "./meta-cron-commentary"
import { sendMetaHourlyReportToTelegram } from "./meta-hourly-report"

export function getCronSecret(): string | undefined {
  return process.env.CRON_SECRET?.trim()
}

export function isValidCronRequest(authHeader: string | null): boolean {
  const secret = getCronSecret()
  if (!secret) return false
  if (!authHeader?.startsWith("Bearer ")) return false
  return authHeader.slice(7).trim() === secret
}

async function sendToAllowedUsers(text: string): Promise<number> {
  const ids = getAllowedTelegramUserIds()
  if (ids.size === 0) {
    console.warn("Meta cron: TELEGRAM_ALLOWED_USER_IDS vacío")
    return 0
  }

  let sent = 0
  for (const chatId of ids) {
    try {
      await sendTelegramLongMessage(chatId, text, { html: true })
      sent += 1
    } catch (error) {
      console.error(`Meta cron Telegram chat ${chatId}:`, error)
    }
  }
  return sent
}

/** Cada hora: resumen + conjuntos ≥10k sin ventas + campañas ≥30k sin ventas. */
export async function runMetaHourlyOperativeReport(): Promise<{
  skipped: boolean
  hour: number
  sent: number
  adsetsToPause: number
  campaignsToPause: number
}> {
  const hour = getDashboardHour()
  const result = await sendMetaHourlyReportToTelegram()

  return {
    skipped: false,
    hour,
    sent: result.sent,
    adsetsToPause: result.adsetsToPause,
    campaignsToPause: result.campaignsToPause,
  }
}

export async function runMetaNightlyReport(): Promise<{
  skipped: boolean
  sent: number
}> {
  const hour = getDashboardHour()
  if (hour !== 23) {
    return { skipped: true, sent: 0 }
  }

  const today = getDashboardToday()
  const informe = await getMetaInformePayload()
  const kpis = await getAccountKpis(getTodayDateRange())

  const soldAdsets: {
    name: string
    campaignName?: string
    purchases: number
  }[] = []

  for (const group of informe.groups) {
    const campaignName = group.campaign.name
    for (const adset of group.adsets) {
      if (adset.purchasesToday > 0) {
        soldAdsets.push({
          name: adset.name,
          campaignName,
          purchases: adset.purchasesToday,
        })
      }
    }
  }

  const mapRowWithCampaign = (row: (typeof informe.sinVentasAlerts)[0]) => ({
    name: row.name,
    campaignName:
      row.type === "adset"
        ? informe.groups.find((g) =>
            g.adsets.some((a) => a.entityId === row.entityId)
          )?.campaign.name
        : undefined,
    spendToday: row.spendToday,
    cpaToday: row.cpaToday,
  })

  const sinVentas = informe.sinVentasAlerts.map(mapRowWithCampaign)
  const cpaAlto = informe.cpaAltoAlerts.map(mapRowWithCampaign)

  const message = await generateNightlyCommentary({
    sinVentas,
    cpaAlto,
    accountSpend: kpis.totalSpend,
    accountPurchases: kpis.purchases,
    soldAdsets,
  })

  const sent = await sendToAllowedUsers(
    `🌙 **Informe IA — cierre ${today}**\n\n` +
      `Gasto: **${formatCop(kpis.totalSpend)}** · Compras: **${kpis.purchases}**\n\n` +
      message
  )

  return { skipped: false, sent }
}

export async function runMetaTelegramCron(): Promise<{
  hour: number
  hourly: Awaited<ReturnType<typeof runMetaHourlyOperativeReport>>
  nightly: Awaited<ReturnType<typeof runMetaNightlyReport>>
}> {
  const hour = getDashboardHour()
  const hourly = await runMetaHourlyOperativeReport()
  const nightly = await runMetaNightlyReport()
  return { hour, hourly, nightly }
}

/** @deprecated Usar runMetaHourlyOperativeReport */
export const runMetaHourlyActivationReport = runMetaHourlyOperativeReport
