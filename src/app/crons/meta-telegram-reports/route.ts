import { NextResponse } from "next/server"
import { isValidCronRequest, unauthorizedCronResponse } from "@/lib/cron-auth"
import { getDashboardHour, getDashboardToday } from "@/lib/date"
import { getAllowedTelegramUserIds } from "@/lib/telegram/config"
import { sendTelegramLongMessage } from "@/lib/telegram/bot"
import {
  formatCop,
  getMetaInformePayload,
} from "@/lib/services/meta/meta-operative-service"
import { generateNightlyCommentary } from "@/lib/services/meta/meta-cron-commentary"
import {
  buildMetaHourlyReportPayload,
  sendMetaHourlyReportToTelegram,
} from "@/lib/services/meta/meta-hourly-report"

export const dynamic = "force-dynamic"
export const maxDuration = 120

/** Informe IA → Telegram, 8:00 y 20:00 Lima (schedules `meta-telegram-8am` / `-8pm`). */
export async function GET(request: Request) {
  if (!isValidCronRequest(request)) return unauthorizedCronResponse()

  try {
    const hour = getDashboardHour()
    const hourly = await runOperativeReport()
    const nightly = await runNightlyReport(hour)
    return NextResponse.json({ ok: true, hour, hourly, nightly })
  } catch (error) {
    console.error("Meta telegram cron:", error)
    const message =
      error instanceof Error ? error.message : "Error en cron Meta"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

/** Informe operativo: una sección por cuenta Meta (apagar / revisar / reactivar). */
async function runOperativeReport() {
  const payload = await buildMetaHourlyReportPayload()
  const result = await sendMetaHourlyReportToTelegram(payload)
  return {
    skipped: false,
    sent: result.sent,
    adsetsToPause: result.adsetsToPause,
    adsetsToReview: result.adsetsToReview,
  }
}

/** Cierre nocturno: solo si la llamada cae a las 23:00 Lima (p. ej. manual). */
async function runNightlyReport(hour: number) {
  if (hour !== 23) {
    return { skipped: true, sent: 0 }
  }

  const informe = await getMetaInformePayload()
  const today = getDashboardToday()
  const kpis = {
    totalSpend: informe.accountSpendToday,
    purchases: informe.accountPurchasesToday,
  }

  const soldAdsets = informe.groups.flatMap((group) =>
    group.adsets
      .filter((adset) => adset.purchasesToday > 0)
      .map((adset) => ({
        name: adset.name,
        campaignName: group.campaign.name,
        purchases: adset.purchasesToday,
      }))
  )

  const mapRowWithCampaign = (row: { name: string; type: string; entityId: string; spendToday: number; cpaToday: number }) => ({
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

  const message = await generateNightlyCommentary({
    sinVentas: informe.sinVentasAlerts.map(mapRowWithCampaign),
    cpaAlto: informe.cpaAltoAlerts.map(mapRowWithCampaign),
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
