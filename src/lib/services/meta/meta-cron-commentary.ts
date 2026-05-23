import { openai } from "@ai-sdk/openai"
import { generateText } from "ai"
import type { InformeCriticoActivoItem } from "./meta-informe-alerts"
import type { MetaHourlyReportPayload } from "./meta-hourly-report"
import { formatCop } from "./meta-operative-service"

/** @deprecated El mensaje horario se arma en meta-hourly-report (solo ON + Crítico). */
export async function generateHourlyOperativeCommentary(
  payload: MetaHourlyReportPayload
): Promise<string> {
  return buildTemplateHourly(payload)
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
  const base = `• **${item.name}** (${item.campaignName})`
  if (item.purchases > 0 && item.cpa > 0) {
    return `${base} · ${formatCop(item.spend)} hoy · ${item.purchases} compra(s) · CPA ${formatCop(item.cpa)}`
  }
  return `${base} · ${formatCop(item.spend)} hoy · 0 compras`
}

function buildTemplateHourly(payload: MetaHourlyReportPayload): string {
  if (payload.adsetsCriticoActivos.length === 0) {
    return "✅ Nada que revisar ahora."
  }

  return payload.adsetsCriticoActivos.map(formatCriticoActivoLine).join("\n")
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
