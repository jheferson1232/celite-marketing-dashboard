import { openai } from "@ai-sdk/openai"
import { generateText } from "ai"
import type { MetaHourlyReportPayload } from "./meta-hourly-report"
import type { OlvidoNotificationItem } from "./meta-operative-service"

export async function generateHourlyOperativeCommentary(
  payload: MetaHourlyReportPayload
): Promise<string> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return buildTemplateHourly(payload)
  }

  try {
    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      system: `Asistente operativo Meta Ads (Colombia, COP, español).
Resumen horario para Telegram: campañas activas hoy, qué conjuntos APAGAR (gasto ≥10k sin compras), qué campañas APAGAR (gasto ≥30k sin compras), olvidos de activación si hay.
Sé directo: lista qué apagar y por qué. Máximo 14 líneas. **negrita** en nombres.`,
      prompt: JSON.stringify(payload, null, 2),
    })
    return text.trim() || buildTemplateHourly(payload)
  } catch (error) {
    console.error("Meta hourly OpenAI:", error)
    return buildTemplateHourly(payload)
  }
}

export async function generateActivationReminderCommentary(
  olvido: OlvidoNotificationItem[],
  hour: number
): Promise<string> {
  if (olvido.length === 0) {
    return `✅ **Meta ${hour}:00** — No hay olvidos de activación (ayer gastó y hoy Meta sigue coherente).`
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return buildTemplateReminder(olvido, hour)
  }

  try {
    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      system: `Eres un asistente operativo de Meta Ads en español (Colombia, COP).
Recuerdas campañas/conjuntos donde AYER hubo gasto pero Meta estaba APAGADO (olvido de activación).
No recomiendas apagar por mal rendimiento. Máximo 8 líneas. Usa **negrita** para nombres.`,
      prompt: `Hora ${hour}:00 (Lima). Ayer gastaron pero Meta estaba OFF — el operador no activó a tiempo:
${JSON.stringify(olvido, null, 2)}

Escribe un recordatorio breve para Telegram. Empieza con emoji de alerta.`,
    })
    return text.trim() || buildTemplateReminder(olvido, hour)
  } catch (error) {
    console.error("Meta cron OpenAI:", error)
    return buildTemplateReminder(olvido, hour)
  }
}

export async function generateNightlyCommentary(payload: {
  olvido: OlvidoNotificationItem[]
  sinVentas: {
    name: string
    campaignName?: string
    spendToday: number
    cpaToday: number
  }[]
  cpaAlto: {
    name: string
    campaignName?: string
    spendToday: number
    cpaToday: number
  }[]
  accountSpend: number
  accountPurchases: number
  soldAdsets: { name: string; campaignName?: string; purchases: number }[]
}): Promise<string> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return buildTemplateNightly(payload)
  }

  try {
    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      system: `Asistente Meta Ads (COP, español). Cierre del día: gasto, ventas, conjuntos que vendieron, olvidos de activación (ayer gastó + Meta OFF), gasto alto sin ventas (−1 punto).
Sugiere qué reactivar mañana si aplica. No ejecutes cambios. Máximo 12 líneas.`,
      prompt: JSON.stringify(payload, null, 2),
    })
    return text.trim() || buildTemplateNightly(payload)
  } catch (error) {
    console.error("Meta nightly OpenAI:", error)
    return buildTemplateNightly(payload)
  }
}

function buildTemplateHourly(payload: MetaHourlyReportPayload): string {
  const campañas =
    payload.campaigns.length > 0
      ? payload.campaigns
          .slice(0, 12)
          .map(
            (c) =>
              `• **${c.name}** ${c.metaWasActive ? "ON" : "OFF"}: ${c.spend.toLocaleString("es-CO")} COP, ${c.purchases} compras, pts ${c.pointsTotal}`
          )
          .join("\n")
      : "• Sin campañas con gasto hoy"

  const conjuntos =
    payload.adsetsToPause.length > 0
      ? payload.adsetsToPause
          .map(
            (a) =>
              `• **${a.name}** (${a.campaignName || "—"}): ${a.spend.toLocaleString("es-CO")} COP, 0 compras → apagar`
          )
          .join("\n")
      : "• Ninguno"

  const campañasApagar =
    payload.campaignsToPause.length > 0
      ? payload.campaignsToPause
          .map(
            (c) =>
              `• **${c.name}**: ${c.spend.toLocaleString("es-CO")} COP, 0 compras → apagar campaña`
          )
          .join("\n")
      : "• Ninguna"

  const olvido =
    payload.olvido.length > 0
      ? payload.olvido
          .map((o) =>
            o.type === "campaign"
              ? `• Campaña **${o.name}**`
              : `• **${o.name}** (${o.campaignName || "—"})`
          )
          .join("\n")
      : "• Ninguno"

  return (
    `**Campañas hoy:**\n${campañas}\n\n` +
    `🔴 **Conjuntos a apagar** (≥10k sin ventas):\n${conjuntos}\n\n` +
    `🔴 **Campañas a apagar** (≥30k sin ventas):\n${campañasApagar}\n\n` +
    `⚠️ **Olvido activación:**\n${olvido}`
  )
}

function buildTemplateReminder(
  olvido: OlvidoNotificationItem[],
  hour: number
): string {
  const lines = olvido.map((f) => {
    if (f.type === "campaign") return `• Campaña **${f.name}**`
    return `• Conjunto **${f.name}** (${f.campaignName || "sin campaña"})`
  })
  return (
    `⚠️ **Meta ${hour}:00** — Ayer gastaron pero no activaste en Meta:\n\n` +
    lines.join("\n") +
    `\n\nEnciéndelos en Ads Manager.`
  )
}

function buildTemplateNightly(payload: {
  olvido: OlvidoNotificationItem[]
  sinVentas: {
    name: string
    campaignName?: string
    spendToday: number
    cpaToday: number
  }[]
  cpaAlto: {
    name: string
    campaignName?: string
    spendToday: number
    cpaToday: number
  }[]
  accountSpend: number
  accountPurchases: number
  soldAdsets: { name: string; campaignName?: string; purchases: number }[]
}): string {
  const sold =
    payload.soldAdsets.length > 0
      ? payload.soldAdsets
          .slice(0, 15)
          .map(
            (s) =>
              `• **${s.name}** (${s.campaignName || "—"}): ${s.purchases} compras`
          )
          .join("\n")
      : "• Ningún conjunto con compras hoy"

  const olvidoLines =
    payload.olvido.length > 0
      ? payload.olvido
          .map((f) =>
            f.type === "campaign"
              ? `• Campaña **${f.name}**`
              : `• **${f.name}** (${f.campaignName || "—"})`
          )
          .join("\n")
      : "• Ninguno"

  const sinVentasLines =
    payload.sinVentas.length > 0
      ? payload.sinVentas
          .slice(0, 10)
          .map(
            (s) =>
              `• **${s.name}** (${s.campaignName || "—"}): ${s.spendToday.toLocaleString("es-CO")} COP sin ventas`
          )
          .join("\n")
      : "• Ninguno"

  const cpaAltoLines =
    payload.cpaAlto.length > 0
      ? payload.cpaAlto
          .slice(0, 10)
          .map(
            (s) =>
              `• **${s.name}** (${s.campaignName || "—"}): CPA ${Math.round(s.cpaToday).toLocaleString("es-CO")} COP`
          )
          .join("\n")
      : "• Ninguno"

  return (
    `🌙 **Meta — cierre 23:00**\n\n` +
    `💰 Gasto hoy: ${payload.accountSpend.toLocaleString("es-CO")} COP · ` +
    `${payload.accountPurchases} compras\n\n` +
    `✅ Vendieron (conjuntos):\n${sold}\n\n` +
    `⚠️ Olvido activación (ayer gastó, Meta OFF):\n${olvidoLines}\n\n` +
    `🔴 Gasto alto sin ventas (−1):\n${sinVentasLines}\n\n` +
    `🔴 CPA > 15k (−1):\n${cpaAltoLines}`
  )
}
