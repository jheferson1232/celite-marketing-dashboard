import { getDashboardHour, getDashboardToday } from "@/lib/date"
import { formatCurrency } from "@/lib/format"
import { claimMetaOnce } from "./meta-cache"
import { listMetaAdAccounts } from "./meta-ad-accounts"
import {
  getMetaInformePayload,
  type InformeAccountInfo,
  type InformeActionItem,
} from "./meta-operative-service"
import { describeInformeReason } from "./meta-informe-rules"
import { sendTelegramLongMessage } from "@/lib/telegram/bot"
import { getAllowedTelegramUserIds } from "@/lib/telegram/config"

export type MetaInformeAccountReport = {
  account: InformeAccountInfo
  cpaTarget: number
  spendToday: number
  purchasesToday: number
  actions: InformeActionItem[]
  /** La cuenta no se pudo leer (API, permisos…). */
  error: string | null
}

export type MetaHourlyReportPayload = {
  hour: number
  date: string
  accounts: MetaInformeAccountReport[]
  /** Cuentas activas sin gasto hoy ni acciones pendientes. */
  idleAccounts: string[]
  /** Cuentas bloqueadas, con pago pendiente, etc. */
  inactiveAccounts: { name: string; statusLabel: string }[]
}

const SKIPPED_STATUS_LABELS = new Set(["Cerrada", "Por cerrar"])

/** Recorre todas las cuentas Meta y arma el informe de cada una. */
export async function buildMetaHourlyReportPayload(): Promise<MetaHourlyReportPayload> {
  const accounts = await listMetaAdAccounts()
  const reports: MetaInformeAccountReport[] = []
  const idleAccounts: string[] = []
  const inactiveAccounts: MetaHourlyReportPayload["inactiveAccounts"] = []

  for (const account of accounts) {
    if (account.statusLabel) {
      if (!SKIPPED_STATUS_LABELS.has(account.statusLabel)) {
        inactiveAccounts.push({
          name: account.name,
          statusLabel: account.statusLabel,
        })
      }
      continue
    }

    try {
      const informe = await getMetaInformePayload({
        accountId: account.accountId,
      })
      if (informe.accountSpendToday <= 0 && informe.actions.length === 0) {
        idleAccounts.push(account.name)
        continue
      }
      reports.push({
        account: informe.account,
        cpaTarget: informe.cpaTarget,
        spendToday: informe.accountSpendToday,
        purchasesToday: informe.accountPurchasesToday,
        actions: informe.actions,
        error: null,
      })
    } catch (error) {
      console.error(`Informe Meta ${account.name}:`, error)
      reports.push({
        account: {
          accountId: account.accountId,
          name: account.name,
          currency: "COP",
          accountStatus: account.accountStatus,
          statusLabel: account.statusLabel,
        },
        cpaTarget: 0,
        spendToday: 0,
        purchasesToday: 0,
        actions: [],
        error: error instanceof Error ? error.message : "Error al leer Meta",
      })
    }
  }

  return {
    hour: getDashboardHour(),
    date: getDashboardToday(),
    accounts: reports,
    idleAccounts,
    inactiveAccounts,
  }
}

const ACTION_ICON: Record<InformeActionItem["accion"], string> = {
  apagar: "🔴 Apagar",
  revisar: "🟠 Revisar",
  reactivar: "🟢 Reactivar",
}

function buildAccountSection(report: MetaInformeAccountReport): string {
  const { account } = report
  if (report.error) {
    return `⚠️ **${account.name}**: no se pudo leer (${report.error})`
  }

  const money = (value: number) => formatCurrency(value, account.currency)
  const cpa =
    report.purchasesToday > 0 ? report.spendToday / report.purchasesToday : 0
  const header =
    `**${account.name}** · ${money(report.spendToday)} · ` +
    `${report.purchasesToday} compra${report.purchasesToday === 1 ? "" : "s"}` +
    (cpa > 0 ? ` · CPA ${money(cpa)}` : "") +
    ` (obj. ${money(report.cpaTarget)})`

  if (report.actions.length === 0) {
    return `${header}\n✅ Nada que revisar`
  }

  const lines = report.actions.map(
    (item) =>
      `${ACTION_ICON[item.accion]}: **${item.name}** (${item.campaignName}) · ` +
      describeInformeReason(item.reason, money)
  )
  return `${header}\n${lines.join("\n")}`
}

export async function buildMetaHourlyTelegramMessage(
  payload?: MetaHourlyReportPayload
): Promise<string> {
  const data = payload ?? (await buildMetaHourlyReportPayload())

  const sections = data.accounts.map(buildAccountSection)
  if (data.idleAccounts.length > 0) {
    sections.push(`Sin gasto hoy: ${data.idleAccounts.join(", ")}`)
  }
  for (const inactive of data.inactiveAccounts) {
    sections.push(`⚠️ **${inactive.name}**: ${inactive.statusLabel} · sin datos`)
  }
  if (data.accounts.length === 0) {
    sections.unshift("⚠️ Ninguna cuenta Meta activa con gasto hoy.")
  }

  return `📊 **Informe Meta ${data.hour}:00** (${data.date})\n\n${sections.join("\n\n")}`
}

function countActions(
  data: MetaHourlyReportPayload,
  accion: InformeActionItem["accion"]
): number {
  return data.accounts.reduce(
    (sum, report) =>
      sum + report.actions.filter((item) => item.accion === accion).length,
    0
  )
}

export async function sendMetaHourlyReportToTelegram(
  payload?: MetaHourlyReportPayload,
  options?: { skipDedup?: boolean }
): Promise<{
  message: string
  sent: number
  skippedDuplicate: boolean
  adsetsToPause: number
  adsetsToReview: number
}> {
  const data = payload ?? (await buildMetaHourlyReportPayload())
  const message = await buildMetaHourlyTelegramMessage(data)
  const counts = {
    adsetsToPause: countActions(data, "apagar"),
    adsetsToReview: countActions(data, "revisar"),
  }

  const dedupKey = `meta-hourly-telegram:${data.date}:${data.hour}`
  if (!options?.skipDedup && !claimMetaOnce(dedupKey, 55 * 60 * 1000)) {
    console.info(
      `Meta hourly: ya enviado para ${data.date} h${data.hour}, omitiendo duplicado`
    )
    return { message, sent: 0, skippedDuplicate: true, ...counts }
  }

  const ids = getAllowedTelegramUserIds()
  if (ids.size === 0) {
    console.warn("Meta hourly: TELEGRAM_ALLOWED_USER_IDS vacío")
    return { message, sent: 0, skippedDuplicate: false, ...counts }
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

  return { message, sent, skippedDuplicate: false, ...counts }
}
