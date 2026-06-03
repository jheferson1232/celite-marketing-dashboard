import prisma from "@/lib/prisma"
import { getAllowedTelegramUserIds } from "@/lib/telegram/config"
import { sendTelegramLongMessage } from "@/lib/telegram/bot"
import { formatCurrency } from "@/lib/format"
import { TIKTOK_AGENT_TRIGGER_LABEL } from "./constants"
import type {
  TikTokAgentPlannedAction,
  TikTokAgentThresholds,
} from "./types"

/** IDs de chat para resúmenes: env primero, si no hay, sesiones del bot en BD. */
export async function getTikTokAgentTelegramRecipientIds(): Promise<string[]> {
  const fromEnv = [...getAllowedTelegramUserIds()]
  if (fromEnv.length > 0) return fromEnv

  const sessions = await prisma.telegramSession.findMany({
    select: { telegramUserId: true },
  })
  return sessions.map((s) => s.telegramUserId)
}

export async function getTikTokAgentTelegramStatus(): Promise<{
  configured: boolean
  botTokenSet: boolean
  allowedUserCount: number
  sessionChatCount: number
  recipientCount: number
}> {
  const botTokenSet = Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim())
  const allowedUserCount = getAllowedTelegramUserIds().size
  const sessionChatCount =
    botTokenSet && prisma.telegramSession
      ? await prisma.telegramSession.count()
      : 0
  const recipientCount =
    allowedUserCount > 0 ? allowedUserCount : sessionChatCount

  return {
    botTokenSet,
    allowedUserCount,
    sessionChatCount,
    recipientCount,
    configured: botTokenSet && recipientCount > 0,
  }
}

function formatActionLine(action: TikTokAgentPlannedAction): string {
  const spend = formatCurrency(action.spendPen, "PEN")
  const scope =
    action.kind === "pause_campaign"
      ? `Campaña <b>${escapeHtml(action.entityName)}</b>`
      : `Conjunto <b>${escapeHtml(action.entityName)}</b> (${escapeHtml(action.campaignName ?? "—")})`
  const status = action.applied
    ? "✅"
    : action.error
      ? `❌ ${escapeHtml(action.error)}`
      : "⏸ dry-run"
  return `${status} ${scope} · ${spend} · ${action.reason}`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

export async function sendTikTokAgentTelegramSummary(input: {
  trigger: string
  dryRun: boolean
  campaignsScanned: number
  adgroupsScanned: number
  actions: TikTokAgentPlannedAction[]
  thresholds: TikTokAgentThresholds
}): Promise<number> {
  if (!input.thresholds.telegramNotify) return 0

  const status = await getTikTokAgentTelegramStatus()
  if (!status.configured) {
    console.warn("TikTok agent: Telegram no configurado")
    return 0
  }

  const applied = input.actions.filter((a) => a.applied).length
  const lines = [
    `<b>🤖 Agente TikTok</b> · ${TIKTOK_AGENT_TRIGGER_LABEL[input.trigger] ?? input.trigger}`,
    input.dryRun ? "<i>Dry run (sin cambios en TikTok)</i>" : "",
    `Campañas: ${input.campaignsScanned} · Conjuntos: ${input.adgroupsScanned}`,
    `Acciones: ${input.actions.length}${input.dryRun ? "" : ` · Aplicadas: ${applied}`}`,
    "",
  ]

  if (input.actions.length === 0) {
    lines.push("Sin pausas sugeridas hoy.")
  } else {
    for (const action of input.actions.slice(0, 25)) {
      lines.push(formatActionLine(action))
    }
    if (input.actions.length > 25) {
      lines.push(`… y ${input.actions.length - 25} más`)
    }
  }

  const text = lines.filter(Boolean).join("\n")
  const ids = await getTikTokAgentTelegramRecipientIds()
  if (ids.length === 0) {
    console.warn("TikTok agent: sin destinatarios Telegram")
    return 0
  }

  let sent = 0
  for (const chatId of ids) {
    try {
      await sendTelegramLongMessage(chatId, text, { html: true })
      sent += 1
    } catch (error) {
      console.error(`TikTok agent Telegram ${chatId}:`, error)
    }
  }
  return sent
}
