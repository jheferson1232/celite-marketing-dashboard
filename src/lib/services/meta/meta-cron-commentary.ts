import { openai } from "@ai-sdk/openai"
import { generateText } from "ai"
import type { InformeCriticoActivoItem } from "./meta-informe-alerts"
import type { MetaHourlyReportPayload } from "./meta-hourly-report"
import { formatCop } from "./meta-operative-service"

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
Resumen horario para Telegram: campañas activas hoy; conjuntos ON en estado Crítico (activos con mal rendimiento hoy); conjuntos/campañas a APAGAR (solo ON: ≥10k/≥30k sin compras).
No sugieras apagar lo que ya está OFF. Máximo 16 líneas. **negrita** en nombres.`,
      prompt: JSON.stringify(payload, null, 2),
    })
    return text.trim() || buildTemplateHourly(payload)
  } catch (error) {
    console.error("Meta hourly OpenAI:", error)
    return buildTemplateHourly(payload)
  }
}

export async function generateNightlyCommentary(payload: {
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
      system: `Asistente Meta Ads (COP, español). Cierre del día: gasto, ventas, conjuntos que vendieron, gasto alto sin ventas, CPA alto.
Sugiere qué revisar mañana si aplica. No ejecutes cambios. Máximo 12 líneas.`,
      prompt: JSON.stringify(payload, null, 2),
    })
    return text.trim() || buildTemplateNightly(payload)
  } catch (error) {
    console.error("Meta nightly OpenAI:", error)
    return buildTemplateNightly(payload)
  }
}

function formatCriticoActivoLine(item: InformeCriticoActivoItem): string {
  const base = `• **${item.name}** (${item.campaignName}): **ON** · **Crítico**`
  if (item.purchases > 0 && item.cpa > 0) {
    return `${base} · ${formatCop(item.spend)} hoy · ${item.purchases} compra(s) · CPA ${formatCop(item.cpa)}`
  }
  return `${base} · ${formatCop(item.spend)} hoy · 0 compras`
}

function buildTemplateHourly(payload: MetaHourlyReportPayload): string {
  const criticoActivos =
    payload.adsetsCriticoActivos.length > 0
      ? payload.adsetsCriticoActivos.map(formatCriticoActivoLine).join("\n")
      : "• Ninguno"

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

  return (
    `**Campañas hoy:**\n${campañas}\n\n` +
    `⚠️ **Conjuntos activos (ON) en Crítico:**\n${criticoActivos}\n\n` +
    `🔴 **Conjuntos a apagar** (≥10k sin ventas):\n${conjuntos}\n\n` +
    `🔴 **Campañas a apagar** (≥30k sin ventas):\n${campañasApagar}`
  )
}

function buildTemplateNightly(payload: {
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
    `🔴 Gasto alto sin ventas:\n${sinVentasLines}\n\n` +
    `🔴 CPA > 15k:\n${cpaAltoLines}`
  )
}
