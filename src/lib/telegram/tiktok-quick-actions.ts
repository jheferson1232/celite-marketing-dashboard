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
import { fetchAllPages } from "@/lib/services/tiktok/fetch-all-pages"
import {
  fetchCachedAdGroupMetricsByDateRange,
  getMetricNumber,
  getPurchases,
} from "@/lib/services/tiktok/report"
import type { TikTokAdGroup } from "@/lib/services/tiktok/types"
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

function formatPurchaseCount(count: number): string {
  return count > 0
    ? `${count} compra${count === 1 ? "" : "s"}`
    : "0 compras"
}

/** Misma lista que el botón «TT conjuntos activos»: campaña activa, conjunto ON, gasto > 0 hoy. */
export type VisibleTikTokAdSet = {
  adgroupId: string
  name: string
  campaignId: string
  campaignName: string
  spend: number
  purchases: number
}

export async function getTikTokVisibleActiveAdSets(
  dateRange: DateRange
): Promise<VisibleTikTokAdSet[]> {
  const [adGroups, metricsByAdGroup, campaigns] = await Promise.all([
    fetchAllPages<TikTokAdGroup>("/adgroup/get/"),
    fetchCachedAdGroupMetricsByDateRange(dateRange),
    getTikTokCampaignsList(dateRange),
  ])

  const campaignById = new Map(campaigns.map((c) => [c.id, c]))

  return adGroups
    .filter((g) => g.operation_status === "ENABLE")
    .map((g) => {
      const metrics = metricsByAdGroup.get(g.adgroup_id) ?? {}
      const spend = getMetricNumber(metrics, "spend")
      const campaign = campaignById.get(g.campaign_id)
      return {
        adgroupId: g.adgroup_id,
        name: g.adgroup_name || "Sin nombre",
        campaignId: g.campaign_id,
        campaignName: campaign?.name ?? "Campaña",
        spend,
        purchases: getPurchases(metrics),
        operationStatus: campaign?.operationStatus,
      }
    })
    .filter(
      (g) => g.spend > 0 && g.operationStatus === "ENABLE"
    )
    .map(({ operationStatus: _, ...g }) => g)
    .sort((a, b) => b.spend - a.spend || a.name.localeCompare(b.name))
}

function adGroupPickerLabel(name: string, spend: number, max = 38): string {
  const spendLabel = pen(spend)
  const room = Math.max(8, max - spendLabel.length - 3)
  const namePart =
    name.length <= room ? name : `…${name.slice(-(room - 1))}`
  return `${namePart} · ${spendLabel}`
}

/** Conjuntos TikTok activos con gasto, agrupados por campaña. */
export async function formatTikTokActiveAdSetsMessage(
  dateRange: DateRange,
  periodLabel = "hoy"
): Promise<string> {
  const activeAdSets = await getTikTokVisibleActiveAdSets(dateRange)

  if (activeAdSets.length === 0) {
    return `**TikTok — conjuntos activos (${periodLabel})**\n\nNo hay conjuntos activos con gasto en este periodo.`
  }

  const campaigns = await getTikTokCampaignsList(dateRange)
  const campaignById = new Map(campaigns.map((c) => [c.id, c]))

  const byCampaign = new Map<
    string,
    {
      name: string
      spend: number
      purchases: number
      adSets: VisibleTikTokAdSet[]
    }
  >()

  for (const adSet of activeAdSets) {
    const campaign = campaignById.get(adSet.campaignId)
    const existing = byCampaign.get(adSet.campaignId)
    if (existing) {
      existing.adSets.push(adSet)
      continue
    }
    byCampaign.set(adSet.campaignId, {
      name: adSet.campaignName,
      spend: campaign?.spend ?? 0,
      purchases: campaign?.results ?? 0,
      adSets: [adSet],
    })
  }

  const sections = [...byCampaign.values()]
    .map((section) => ({
      ...section,
      adSets: [...section.adSets].sort(
        (a, b) => b.spend - a.spend || a.name.localeCompare(b.name)
      ),
    }))
    .sort((a, b) => b.spend - a.spend || a.name.localeCompare(b.name))
    .slice(0, 10)

  const totalSpend = activeAdSets.reduce((sum, g) => sum + g.spend, 0)
  const totalPurchases = activeAdSets.reduce((sum, g) => sum + g.purchases, 0)

  const blocks = sections.map((section) => {
    const adSetLines = section.adSets.map((g) => {
      return `   **${g.name}**\n      Gasto ${pen(g.spend)} · ${formatPurchaseCount(g.purchases)}`
    })
    return (
      `* **${section.name}**\n` +
      `   Gasto ${pen(section.spend)} · ${formatPurchaseCount(section.purchases)}\n` +
      adSetLines.join("\n")
    )
  })

  return (
    `**TikTok — conjuntos activos (${periodLabel})**\n` +
    `${activeAdSets.length} conjunto${activeAdSets.length === 1 ? "" : "s"} · ` +
    `Gasto ${pen(totalSpend)} · ${totalPurchases} compras\n\n` +
    blocks.join("\n\n")
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

export async function buildAdGroupPausePickerKeyboard(
  dateRange: DateRange
): Promise<InlineKeyboardButton[][]> {
  const visible = await getTikTokVisibleActiveAdSets(dateRange)

  const rows: InlineKeyboardButton[][] = visible.slice(0, 8).map((g) => [
    {
      text: `⏸ ${adGroupPickerLabel(g.name, g.spend)}`,
      callback_data: assertCallbackDataLength(
        encodeCallback({ type: "select_pause_adgroup", adgroupId: g.adgroupId })
      ),
    },
  ])

  rows.push([{ text: "❌ Cancelar", callback_data: "x" }])
  return rows
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

export async function resolveAdGroupName(
  adgroupId: string
): Promise<string> {
  const adGroups = await fetchAllPages<TikTokAdGroup>("/adgroup/get/")
  return (
    adGroups.find((g) => g.adgroup_id === adgroupId)?.adgroup_name ?? adgroupId
  )
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
    text: `**${groupName}**\nPresupuesto actual: ${currentLabel}\n\nToca el monto o % para aplicar:`,
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
    return {
      text: await executeConfirmActivate(matches[0]!.campaignId),
    }
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
    return {
      text: await executeConfirmPause(matches[0]!.campaignId),
    }
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

export async function pauseAdGroupByNameQuery(
  nameQuery: string
): Promise<{ text: string; keyboard?: InlineKeyboardButton[][] }> {
  const dateRange = parseDateRangeArg("hoy")
  const normalized = nameQuery.trim().toLowerCase()
  const visible = await getTikTokVisibleActiveAdSets(dateRange)
  const matches = visible.filter((g) =>
    g.name.toLowerCase().includes(normalized)
  )

  if (matches.length === 0) {
    return {
      text: `No encontré "${nameQuery}" entre los conjuntos activos con gasto hoy. Revisa **🎯 TT conjuntos activos**.`,
    }
  }
  if (matches.length === 1) {
    return {
      text: await executeConfirmPauseAdGroup(matches[0]!.adgroupId),
    }
  }

  const rows: InlineKeyboardButton[][] = matches.slice(0, 6).map((g) => [
    {
      text: adGroupPickerLabel(g.name, g.spend),
      callback_data: assertCallbackDataLength(
        encodeCallback({ type: "select_pause_adgroup", adgroupId: g.adgroupId })
      ),
    },
  ])
  rows.push([{ text: "❌ Cancelar", callback_data: "x" }])
  return {
    text: `Varios conjuntos activos coinciden con "${nameQuery}". Elige uno:`,
    keyboard: rows,
  }
}

export async function setAdGroupBudgetByQuery(
  nameQuery: string,
  budget: number
): Promise<{ text: string; keyboard?: InlineKeyboardButton[][] }> {
  const dateRange = parseDateRangeArg("hoy")
  const normalized = nameQuery.trim().toLowerCase()
  const visible = await getTikTokVisibleActiveAdSets(dateRange)
  const matches = visible.filter((g) =>
    g.name.toLowerCase().includes(normalized)
  )

  if (matches.length === 0) {
    return {
      text: `No encontré "${nameQuery}" entre los conjuntos activos con gasto hoy.`,
    }
  }
  if (matches.length === 1) {
    return {
      text: await executeConfirmBudget(matches[0]!.adgroupId, budget),
    }
  }

  const rows: InlineKeyboardButton[][] = matches.slice(0, 6).map((g) => [
    {
      text: adGroupPickerLabel(g.name, g.spend),
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
  const name = await resolveAdGroupName(adgroupId)
  await updateTikTokAdGroupStatus([adgroupId], "DISABLE")
  clearTikTokCache()
  return `✅ Conjunto **${name}** pausado en TikTok.`
}

