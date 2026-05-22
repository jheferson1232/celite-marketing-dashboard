import {
  getDashboardHour,
  getDashboardToday,
  getTodayDateRange,
} from "@/lib/date"
import { getAllowedTelegramUserIds } from "@/lib/telegram/config"
import { sendTelegramLongMessage } from "@/lib/telegram/bot"
import { getAccountKpis } from "./account-kpis"
import {
  formatCop,
  getForgottenActivations,
  getMetaInformePayload,
} from "./meta-operative-service"
import {
  generateActivationReminderCommentary,
  generateNightlyCommentary,
} from "./meta-cron-commentary"

export function getCronSecret(): string | undefined {
  return process.env.CRON_SECRET?.trim()
}

export function isValidCronRequest(authHeader: string | null): boolean {
  const secret = getCronSecret()
  if (!secret) return false
  if (!authHeader?.startsWith("Bearer ")) return false
  return authHeader.slice(7) === secret
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

export async function runMetaHourlyActivationReport(): Promise<{
  skipped: boolean
  hour: number
  forgottenCount: number
  sent: number
}> {
  const hour = getDashboardHour()
  if (hour < 8 || hour > 18) {
    return { skipped: true, hour, forgottenCount: 0, sent: 0 }
  }

  const forgotten = await getForgottenActivations()
  const message = await generateActivationReminderCommentary(forgotten, hour)
  const sent = await sendToAllowedUsers(message)

  return {
    skipped: false,
    hour,
    forgottenCount: forgotten.length,
    sent,
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

  const stillOffMarked = informe.forgotten.map((f) => ({
    type: f.type,
    name: f.name,
    campaignName:
      f.type === "adset"
        ? informe.groups.find((g) =>
            g.adsets.some((a) => a.entityId === f.entityId)
          )?.campaign.name
        : undefined,
  }))

  const message = await generateNightlyCommentary({
    forgotten: stillOffMarked,
    accountSpend: kpis.totalSpend,
    accountPurchases: kpis.purchases,
    soldAdsets,
    stillOffMarked,
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
  hourly: Awaited<ReturnType<typeof runMetaHourlyActivationReport>>
  nightly: Awaited<ReturnType<typeof runMetaNightlyReport>>
}> {
  const hour = getDashboardHour()
  const hourly = await runMetaHourlyActivationReport()
  const nightly = await runMetaNightlyReport()
  return { hour, hourly, nightly }
}
