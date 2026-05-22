import { openai } from "@ai-sdk/openai"
import { generateText } from "ai"
import type { ForgottenActivationItem } from "./meta-operative-service"

export async function generateActivationReminderCommentary(
  forgotten: ForgottenActivationItem[],
  hour: number
): Promise<string> {
  if (forgotten.length === 0) {
    return (
      `✅ **Meta ${hour}:00** — Todo lo que marcaste como activo está encendido en Meta.`
    )
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return buildTemplateReminder(forgotten, hour)
  }

  try {
    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      system: `Eres un asistente operativo de Meta Ads en español (Colombia, COP).
Solo ayudas a recordar si el usuario olvidó activar campañas o conjuntos que marcó como activos.
No recomiendas apagar por mal rendimiento. Máximo 8 líneas. Usa **negrita** para nombres.`,
      prompt: `Hora ${hour}:00 (Lima). El usuario marcó que activó estos elementos pero en Meta siguen APAGADOS:
${JSON.stringify(forgotten, null, 2)}

Escribe un recordatorio breve y claro para Telegram. Empieza con un emoji de alerta.`,
    })
    return text.trim() || buildTemplateReminder(forgotten, hour)
  } catch (error) {
    console.error("Meta cron OpenAI:", error)
    return buildTemplateReminder(forgotten, hour)
  }
}

export async function generateNightlyCommentary(payload: {
  forgotten: ForgottenActivationItem[]
  accountSpend: number
  accountPurchases: number
  soldAdsets: { name: string; campaignName?: string; purchases: number }[]
  stillOffMarked: ForgottenActivationItem[]
}): Promise<string> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return buildTemplateNightly(payload)
  }

  try {
    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      system: `Asistente Meta Ads (COP, español). Cierre del día: gasto, ventas, qué conjuntos vendieron, qué olvidó activar.
Sugiere qué reactivar mañana si marcó activo pero sigue apagado y tuvo buen historial. No ejecutes cambios. Máximo 12 líneas.`,
      prompt: JSON.stringify(payload, null, 2),
    })
    return text.trim() || buildTemplateNightly(payload)
  } catch (error) {
    console.error("Meta nightly OpenAI:", error)
    return buildTemplateNightly(payload)
  }
}

function buildTemplateReminder(
  forgotten: ForgottenActivationItem[],
  hour: number
): string {
  const lines = forgotten.map((f) => {
    if (f.type === "campaign") return `• Campaña **${f.name}**`
    return `• Conjunto **${f.name}** (${f.campaignName || "sin campaña"})`
  })
  return (
    `⚠️ **Meta ${hour}:00** — Marcaste que activaste pero en Meta sigue apagado:\n\n` +
    lines.join("\n") +
    `\n\nEnciéndelos en Ads Manager y marca el check en Informe IA.`
  )
}

function buildTemplateNightly(payload: {
  forgotten: ForgottenActivationItem[]
  accountSpend: number
  accountPurchases: number
  soldAdsets: { name: string; campaignName?: string; purchases: number }[]
  stillOffMarked: ForgottenActivationItem[]
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

  const off =
    payload.stillOffMarked.length > 0
      ? payload.stillOffMarked
          .map((f) =>
            f.type === "campaign"
              ? `• Campaña **${f.name}**`
              : `• **${f.name}** (${f.campaignName || "—"})`
          )
          .join("\n")
      : "• Nada pendiente"

  return (
    `🌙 **Meta — cierre 23:00**\n\n` +
    `💰 Gasto hoy: ${payload.accountSpend.toLocaleString("es-CO")} COP · ` +
    `${payload.accountPurchases} compras\n\n` +
    `✅ Vendieron (conjuntos):\n${sold}\n\n` +
    `⏸ Marcaste activo pero sigue apagado:\n${off}\n\n` +
    `Mañana: reactiva en Meta y actualiza checks en Informe IA.`
  )
}
