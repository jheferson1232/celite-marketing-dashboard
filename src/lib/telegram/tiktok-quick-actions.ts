import {
  addDaysToDateString,
  getDashboardToday,
  getDashboardYesterday,
} from "@/lib/date"
import { formatCurrency, TIKTOK_DASHBOARD_CURRENCY } from "@/lib/format"
import type { DateRange } from "@/lib/services/meta/types"
import { getTikTokAccountKpis } from "@/lib/services/tiktok/account-kpis"
import { getTikTokCampaignAdGroupsByCampaignId } from "@/lib/services/tiktok/campaign-adgroups"
import { getTikTokCampaignsList } from "@/lib/services/tiktok/campaigns-list"
import {
  getTikTokAdGroupDailyBudget,
  setTikTokCampaignStatusOnly,
  updateTikTokAdGroupBudget,
  updateTikTokAdGroupStatus,
} from "@/lib/services/tiktok/manage"
import { clearTikTokCache } from "@/lib/services/tiktok/tiktok-cache"
import {
  findTikTokAdGroupsByName,
  findTikTokCampaignsByName,
} from "@/lib/chat/tiktok-tool-helpers"
import type { InlineKeyboardButton } from "./bot"
import {
  assertCallbackDataLength,
  encodeCallback,
} from "./callback-data"
import { getConfirmCancelRow } from "./keyboards"

function pen(amount: number): string {
  return formatCurrency(amount, TIKTOK_DASHBOARD_CURRENCY)
}

export function parseDateRangeArg(arg?: string): DateRange {
  const today = getDashboardToday()
  const normalized = (arg ?? "hoy").toLowerCase().trim()

  if (normalized === "ayer") {
    const y = getDashboardYesterday()
    return { from: y, to: y }
  }
  if (normalized === "7d" || normalized === "7" || normalized === "semana") {
    return { from: addDaysToDateString(today, -6), to: today }
  }
  return { from: today, to: today }
}

export async function formatTikTokKpisMessage(
  dateRange: DateRange,
  label: string
): Promise<string> {
  const kpis = await getTikTokAccountKpis(dateRange)
  return (
    `**TikTok — ${label}**\n` +
    `- **Gasto total:** ${pen(kpis.totalSpend)}\n` +
    `- **Compras:** ${kpis.purchases}\n` +
    `- **CPA:** ${kpis.purchases > 0 ? pen(kpis.cpa) : "—"}`
  )
}

/** Campañas TikTok activas (ENABLE) con gasto y compras del rango. */
export async function formatTikTokActiveCampaignsMessage(
  dateRange: DateRange,
  periodLabel = "hoy"
): Promise<string> {
  const campaigns = await getTikTokCampaignsList(dateRange)
  const active = campaigns
    .filter((c) => c.operationStatus === "ENABLE")
    .sort((a, b) => b.spend - a.spend || a.name.localeCompare(b.name))
    .slice(0, 25)

  if (active.length === 0) {
    return `**TikTok — campañas activas (${periodLabel})**\n\nNo hay campañas activas en este periodo.`
  }

  const lines = active.map((c) => {
    const compras =
      c.results > 0 ? `${c.results} compra${c.results === 1 ? "" : "s"}` : "0 compras"
    return `🟢 **${c.name}**\n   Gasto ${pen(c.spend)} · ${compras}`
  })

  const totalSpend = active.reduce((sum, c) => sum + c.spend, 0)
  const totalPurchases = active.reduce((sum, c) => sum + c.results, 0)

  return (
    `**TikTok — campañas activas (${periodLabel})**\n` +
    `${active.length} campaña${active.length === 1 ? "" : "s"} · ` +
    `Gasto ${pen(totalSpend)} · ${totalPurchases} compras\n\n` +
    lines.join("\n\n")
  )
}

export async function formatTikTokCampaignsMessage(
  dateRange: DateRange
): Promise<string> {
  const campaigns = await getTikTokCampaignsList(dateRange)
  const top = campaigns
    .filter((c) => c.spend > 0 || c.operationStatus === "ENABLE")
    .slice(0, 12)

  if (top.length === 0) {
    return "No hay campañas con actividad en el rango seleccionado."
  }

  const lines = top.map((c) => {
    const state =
      c.operationStatus === "ENABLE" ? "🟢" : "⏸"
    const budget =
      c.dailyBudget != null && c.dailyBudget > 0
        ? ` · S/${c.dailyBudget}/día`
        : c.adGroupDailyBudgetSum != null && c.adGroupDailyBudgetSum > 0
          ? ` · Σ S/${c.adGroupDailyBudgetSum}/día`
          : ""
    return `${state} **${c.name}**\n   Gasto ${pen(c.spend)} · ${c.results} compras${budget}`
  })

  return `**Campañas TikTok (top ${top.length})**\n\n${lines.join("\n\n")}`
}

function truncateLabel(name: string, max = 28): string {
  const trimmed = name.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

export async function buildCampaignPickerKeyboard(
  mode: "pause" | "activate",
  dateRange: DateRange
): Promise<InlineKeyboardButton[][]> {
  const campaigns = await getTikTokCampaignsList(dateRange)
  const sorted = [...campaigns].sort((a, b) => b.spend - a.spend)
  const rows: InlineKeyboardButton[][] = []

  for (const campaign of sorted.slice(0, 8)) {
    const data = assertCallbackDataLength(
      encodeCallback(
        mode === "pause"
          ? { type: "select_pause", campaignId: campaign.id }
          : { type: "select_activate", campaignId: campaign.id }
      )
    )
    rows.push([
      {
        text: `${mode === "pause" ? "⏸" : "▶️"} ${truncateLabel(campaign.name)}`,
        callback_data: data,
      },
    ])
  }

  rows.push([{ text: "❌ Cancelar", callback_data: "x" }])
  return rows
}

export async function buildAdGroupBudgetPickerKeyboard(
  dateRange: DateRange
): Promise<{ text: string; keyboard: InlineKeyboardButton[][] }> {
  const campaigns = await getTikTokCampaignsList(dateRange)
  const topCampaign = [...campaigns].sort((a, b) => b.spend - a.spend)[0]

  if (!topCampaign?.id) {
    return {
      text: "No hay campañas para listar conjuntos.",
      keyboard: [[{ text: "❌ Cancelar", callback_data: "x" }]],
    }
  }

  const adGroups = await getTikTokCampaignAdGroupsByCampaignId(
    topCampaign.id,
    dateRange
  )
  const sorted = [...adGroups].sort((a, b) => b.spend - a.spend)
  const rows: InlineKeyboardButton[][] = []

  for (const group of sorted.slice(0, 8)) {
    const data = assertCallbackDataLength(
      encodeCallback({ type: "select_budget", adgroupId: group.id })
    )
    const budget =
      group.dailyBudget != null && group.dailyBudget > 0
        ? ` S/${group.dailyBudget}`
        : ""
    rows.push([
      {
        text: `${truncateLabel(group.name)}${budget}`,
        callback_data: data,
      },
    ])
  }

  rows.push([{ text: "❌ Cancelar", callback_data: "x" }])

  return {
    text: `Elige un **conjunto** de "${topCampaign.name}" (por gasto hoy):`,
    keyboard: rows,
  }
}

export async function buildBudgetAmountKeyboard(
  adgroupId: string,
  currentBudget: number | null
): Promise<InlineKeyboardButton[][]> {
  const base = currentBudget != null && currentBudget > 0 ? currentBudget : 30
  const presets = [
    Math.max(1, Math.round(base)),
    Math.max(1, Math.round(base + 10)),
    Math.max(1, Math.round(base + 20)),
  ]
  const uniquePresets = [...new Set(presets)]

  const amountRow: InlineKeyboardButton[] = uniquePresets.map((amount) => ({
    text: `S/ ${amount}`,
    callback_data: assertCallbackDataLength(
      encodeCallback({ type: "confirm_budget", adgroupId, budget: amount })
    ),
  }))

  const percentRow: InlineKeyboardButton[] = [
    {
      text: "+10%",
      callback_data: assertCallbackDataLength(
        encodeCallback({
          type: "confirm_budget_percent",
          adgroupId,
          percent: 10,
        })
      ),
    },
    {
      text: "+20%",
      callback_data: assertCallbackDataLength(
        encodeCallback({
          type: "confirm_budget_percent",
          adgroupId,
          percent: 20,
        })
      ),
    },
  ]

  return [amountRow, percentRow, [{ text: "❌ Cancelar", callback_data: "x" }]]
}

export async function resolveCampaignName(
  campaignId: string,
  dateRange: DateRange
): Promise<string> {
  const campaigns = await getTikTokCampaignsList(dateRange)
  return campaigns.find((c) => c.id === campaignId)?.name ?? campaignId
}

export async function getConfirmPauseMessage(
  campaignId: string,
  dateRange: DateRange
): Promise<{ text: string; keyboard: InlineKeyboardButton[][] }> {
  const name = await resolveCampaignName(campaignId, dateRange)
  return {
    text: `¿**Pausar** la campaña?\n\n**${name}**\n\nSolo se apaga la campaña (los conjuntos no cambian).`,
    keyboard: getConfirmCancelRow(
      assertCallbackDataLength(
        encodeCallback({ type: "confirm_pause", campaignId })
      )
    ),
  }
}

export async function getConfirmActivateMessage(
  campaignId: string,
  dateRange: DateRange
): Promise<{ text: string; keyboard: InlineKeyboardButton[][] }> {
  const name = await resolveCampaignName(campaignId, dateRange)
  return {
    text: `¿**Activar** la campaña?\n\n**${name}**`,
    keyboard: getConfirmCancelRow(
      assertCallbackDataLength(
        encodeCallback({ type: "confirm_activate", campaignId })
      )
    ),
  }
}

export async function getBudgetPickerMessage(
  adgroupId: string,
  dateRange: DateRange
): Promise<{ text: string; keyboard: InlineKeyboardButton[][] }> {
  const campaigns = await getTikTokCampaignsList(dateRange)
  let groupName = adgroupId
  let current: number | null = null

  for (const campaign of campaigns) {
    const adGroups = await getTikTokCampaignAdGroupsByCampaignId(
      campaign.id,
      dateRange
    )
    const found = adGroups.find((g) => g.id === adgroupId)
    if (found) {
      groupName = found.name
      current = found.dailyBudget ?? null
      break
    }
  }

  if (current == null) {
    current = await getTikTokAdGroupDailyBudget(adgroupId)
  }

  const currentLabel =
    current != null && current > 0 ? pen(current) : "sin definir"

  return {
    text: `**${groupName}**\nPresupuesto actual: ${currentLabel}\n\nElige monto o % (luego confirma):`,
    keyboard: await buildBudgetAmountKeyboard(adgroupId, current),
  }
}

export async function executeConfirmPause(
  campaignId: string
): Promise<string> {
  const dateRange = parseDateRangeArg("hoy")
  const name = await resolveCampaignName(campaignId, dateRange)
  const state = await setTikTokCampaignStatusOnly(campaignId, "DISABLE")
  clearTikTokCache()

  if (state.campaignOperationStatus !== "DISABLE") {
    return `No se pudo pausar "${name}" en TikTok.`
  }
  return `✅ Campaña **${name}** pausada.`
}

export async function executeConfirmActivate(
  campaignId: string
): Promise<string> {
  const dateRange = parseDateRangeArg("hoy")
  const name = await resolveCampaignName(campaignId, dateRange)
  const state = await setTikTokCampaignStatusOnly(campaignId, "ENABLE")

  if (state.campaignOperationStatus !== "ENABLE") {
    return `No se pudo activar "${name}" en TikTok.`
  }
  clearTikTokCache()
  return `✅ Campaña **${name}** activada.`
}

export async function executeConfirmBudget(
  adgroupId: string,
  budget: number
): Promise<string> {
  await updateTikTokAdGroupBudget(adgroupId, budget)
  clearTikTokCache()
  return `✅ Presupuesto del conjunto actualizado a **${pen(budget)}/día**.`
}

export async function executeConfirmBudgetPercent(
  adgroupId: string,
  percent: number
): Promise<string> {
  const current = await getTikTokAdGroupDailyBudget(adgroupId)
  if (current == null || current <= 0) {
    return "Este conjunto no tiene presupuesto diario editable en la API."
  }
  const next = Math.max(1, current * (1 + percent / 100))
  await updateTikTokAdGroupBudget(adgroupId, Math.round(next * 100) / 100)
  clearTikTokCache()
  return `✅ Presupuesto: ${pen(current)} → **${pen(next)}/día** (+${percent}%).`
}

export async function activateCampaignByNameQuery(
  nameQuery: string
): Promise<{ text: string; keyboard?: InlineKeyboardButton[][] }> {
  const dateRange = parseDateRangeArg("hoy")
  const campaigns = await getTikTokCampaignsList(dateRange)
  const matches = findTikTokCampaignsByName(campaigns, nameQuery)

  if (matches.length === 0) {
    return { text: `No encontré campaña TikTok con "${nameQuery}".` }
  }
  if (matches.length === 1) {
    return getConfirmActivateMessage(matches[0]!.campaignId, dateRange)
  }

  const rows: InlineKeyboardButton[][] = matches.slice(0, 6).map((c) => [
    {
      text: truncateLabel(c.name),
      callback_data: assertCallbackDataLength(
        encodeCallback({ type: "select_activate", campaignId: c.campaignId })
      ),
    },
  ])
  rows.push([{ text: "❌ Cancelar", callback_data: "x" }])
  return {
    text: `Varias campañas coinciden con "${nameQuery}". Elige una:`,
    keyboard: rows,
  }
}

export async function pauseCampaignByNameQuery(
  nameQuery: string
): Promise<{ text: string; keyboard?: InlineKeyboardButton[][] }> {
  const dateRange = parseDateRangeArg("hoy")
  const campaigns = await getTikTokCampaignsList(dateRange)
  const matches = findTikTokCampaignsByName(campaigns, nameQuery)

  if (matches.length === 0) {
    return { text: `No encontré campaña TikTok con "${nameQuery}".` }
  }
  if (matches.length === 1) {
    const msg = await getConfirmPauseMessage(matches[0]!.campaignId, dateRange)
    return msg
  }

  const rows: InlineKeyboardButton[][] = matches.slice(0, 6).map((c) => [
    {
      text: truncateLabel(c.name),
      callback_data: assertCallbackDataLength(
        encodeCallback({ type: "select_pause", campaignId: c.campaignId })
      ),
    },
  ])
  rows.push([{ text: "❌ Cancelar", callback_data: "x" }])
  return {
    text: `Varias campañas coinciden con "${nameQuery}". Elige una:`,
    keyboard: rows,
  }
}

export async function setAdGroupBudgetByQuery(
  nameQuery: string,
  budget: number
): Promise<{ text: string; keyboard?: InlineKeyboardButton[][] }> {
  const dateRange = parseDateRangeArg("hoy")
  const campaigns = await getTikTokCampaignsList(dateRange)

  let allMatches: { adgroupId: string; name: string }[] = []

  for (const campaign of campaigns) {
    const adGroups = await getTikTokCampaignAdGroupsByCampaignId(
      campaign.id,
      dateRange
    )
    allMatches.push(
      ...findTikTokAdGroupsByName(adGroups, nameQuery).map((g) => ({
        adgroupId: g.adgroupId,
        name: g.name,
      }))
    )
  }

  if (allMatches.length === 0) {
    return { text: `No encontré conjunto con "${nameQuery}".` }
  }
  if (allMatches.length === 1) {
    const id = allMatches[0]!.adgroupId
    return {
      text: `¿Poner **${allMatches[0]!.name}** en **${pen(budget)}/día**?`,
      keyboard: getConfirmCancelRow(
        assertCallbackDataLength(
          encodeCallback({ type: "confirm_budget", adgroupId: id, budget })
        )
      ),
    }
  }

  const rows: InlineKeyboardButton[][] = allMatches.slice(0, 6).map((g) => [
    {
      text: truncateLabel(g.name),
      callback_data: assertCallbackDataLength(
        encodeCallback({
          type: "confirm_budget",
          adgroupId: g.adgroupId,
          budget,
        })
      ),
    },
  ])
  rows.push([{ text: "❌ Cancelar", callback_data: "x" }])

  return {
    text: `Varios conjuntos coinciden. ¿Cuál a **${pen(budget)}/día**?`,
    keyboard: rows,
  }
}

export async function executeConfirmPauseAdGroup(
  adgroupId: string
): Promise<string> {
  await updateTikTokAdGroupStatus([adgroupId], "DISABLE")
  clearTikTokCache()
  return `✅ Conjunto pausado en TikTok.`
}
