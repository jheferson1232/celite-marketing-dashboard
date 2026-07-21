import "server-only"
import axios from "axios"
import { formatCurrency, META_DASHBOARD_CURRENCY } from "@/lib/format"
import { mapOpenAiVoiceErrorMessage } from "@/lib/openai-voice-errors"
import { collectAdsetsCriticoActivos } from "./meta-informe-alerts"
import {
  getMetaInformePayload,
  type MetaInformePayload,
} from "./meta-operative-service"
import { getInformeEntityEstadoDisplay } from "./meta-informe-scoring"

const REALTIME_MODEL = "gpt-realtime-2.1"
const REALTIME_VOICE = "marin"
const SUMMARY_MAX_CHARS = 10_000

function money(n: number): string {
  return formatCurrency(n, META_DASHBOARD_CURRENCY)
}

/** Resumen compacto del informe para el contexto de la sesión de voz. */
export function buildInformeVoiceSummary(informe: MetaInformePayload): string {
  const lines: string[] = []
  lines.push(`Hoy (Lima): ${informe.date}`)
  lines.push(`Ayer: ${informe.yesterday}`)
  lines.push(
    `Cuenta hoy: gasto ${money(informe.accountSpendToday)}, compras ${informe.accountPurchasesToday}`
  )
  lines.push(
    `Tabla hoy: gasto ${money(informe.totals.spendToday)}, compras ${informe.totals.purchasesToday}, CPA ${money(informe.totals.cpaToday)}`
  )
  lines.push(
    `Periodo informe: ${informe.informeStartDate} → ${informe.date} (${informe.dateKeys.length} días)`
  )

  const dayLines = informe.totals.dayTotals
    .slice()
    .reverse()
    .map(
      (d) =>
        `  ${d.date}: gasto ${money(d.spend)}, compras ${d.purchases}, puntos ${d.points}`
    )
  lines.push("Totales por día:")
  lines.push(...dayLines)

  const criticos = collectAdsetsCriticoActivos(informe.groups)
  lines.push(`Conjuntos ON en Crítico hoy: ${criticos.length}`)
  for (const item of criticos.slice(0, 20)) {
    lines.push(
      `  - ${item.name} (${item.campaignName}): gasto ${money(item.spend)}, compras ${item.purchases}, CPA ${money(item.cpa)}`
    )
  }
  if (criticos.length > 20) {
    lines.push(`  … y ${criticos.length - 20} más`)
  }

  if (informe.adsetsToPause.length > 0) {
    lines.push(
      `Sugeridos apagar (conjuntos ON sin compras, gasto alto): ${informe.adsetsToPause.length}`
    )
    for (const item of informe.adsetsToPause.slice(0, 12)) {
      lines.push(
        `  - ${item.name}${item.campaignName ? ` (${item.campaignName})` : ""}: ${money(item.spend)}`
      )
    }
  }

  if (informe.campaignsToPause.length > 0) {
    lines.push(
      `Campañas ON sin compras (gasto alto): ${informe.campaignsToPause.length}`
    )
    for (const item of informe.campaignsToPause.slice(0, 8)) {
      lines.push(`  - ${item.name}: ${money(item.spend)}`)
    }
  }

  lines.push(`Campañas en informe: ${informe.groups.length}`)
  const ranked = [...informe.groups]
    .sort((a, b) => b.campaign.spendToday - a.campaign.spendToday)
    .slice(0, 25)

  for (const group of ranked) {
    const c = group.campaign
    const estado = getInformeEntityEstadoDisplay({
      type: "campaign",
      spendToday: c.spendToday,
      purchasesToday: c.purchasesToday,
      cpaToday: c.cpaToday,
    })
    lines.push(
      `Campaña "${c.name}" [${c.metaWasActive ? "ON" : "OFF"}] estado=${estado.label}: hoy gasto ${money(c.spendToday)}, compras ${c.purchasesToday}, CPA ${money(c.cpaToday)}; periodo gasto ${money(c.spendInformeTotal)}, compras ${c.purchasesInformeTotal}, CPA ${money(c.cpaInformeTotal)}; conjuntos ${group.adSetsCount} (activos ${group.activeAdSetsCount})`
    )
    const topAdsets = [...group.adsets]
      .sort((a, b) => b.spendToday - a.spendToday)
      .slice(0, 6)
    for (const a of topAdsets) {
      const aEstado = getInformeEntityEstadoDisplay({
        type: "adset",
        spendToday: a.spendToday,
        purchasesToday: a.purchasesToday,
        cpaToday: a.cpaToday,
      })
      lines.push(
        `  · Conjunto "${a.name}" [${a.metaWasActive ? "ON" : "OFF"}] ${aEstado.label}: hoy ${money(a.spendToday)} / ${a.purchasesToday} compras / CPA ${money(a.cpaToday)}`
      )
    }
  }

  let text = lines.join("\n")
  if (text.length > SUMMARY_MAX_CHARS) {
    text =
      text.slice(0, SUMMARY_MAX_CHARS) +
      "\n… (resumen truncado; prioriza críticos ON y totales de cuenta)"
  }
  return text
}

export function buildInformeVoiceInstructions(summary: string): string {
  return [
    "Eres el asistente de voz del Informe IA de Meta Ads (Celite).",
    "Hablas en español latinoamericano, claro y breve (2–5 oraciones salvo que pidan detalle).",
    "Moneda: pesos colombianos (COP), símbolo $.",
    "Zona horaria de los datos: America/Lima.",
    "Solo consultas: puedes explicar estados (Excelente / En curso / Crítico), CPA, gasto, compras, qué conjuntos ON están en crítico y qué conviene revisar.",
    "No puedes apagar campañas, cambiar presupuestos ni ejecutar acciones en Meta. Si piden hacerlo, explica que aquí solo consultas y que usen la tabla o Telegram.",
    "Si un dato no está en el resumen, dilo con honestidad.",
    "Al saludar, ofrece ayuda con el informe de hoy (críticos, CPA, gasto).",
    "",
    "DATOS ACTUALES DEL INFORME (snapshot al conectar):",
    summary,
  ].join("\n")
}

export type InformeRealtimeClientSecret = {
  value: string
  expiresAt: number | null
  model: string
  date: string
}

/** Crea un client secret efímero de Realtime con el snapshot del informe. */
export async function createInformeRealtimeClientSecret(): Promise<InformeRealtimeClientSecret> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY no está configurada. Añádela en Vercel para usar la voz del informe."
    )
  }

  const informe = await getMetaInformePayload()
  const summary = buildInformeVoiceSummary(informe)
  const instructions = buildInformeVoiceInstructions(summary)

  const { data } = await axios.post<{
    value?: string
    expires_at?: number
    error?: { message?: string }
  }>(
    "https://api.openai.com/v1/realtime/client_secrets",
    {
      session: {
        type: "realtime",
        model: REALTIME_MODEL,
        instructions,
        audio: {
          input: {
            transcription: {
              model: "gpt-4o-mini-transcribe",
            },
          },
          output: {
            voice: REALTIME_VOICE,
          },
        },
      },
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": "celite-informe-ia",
      },
      validateStatus: () => true,
    }
  )

  if (!data?.value) {
    const message =
      data?.error?.message ||
      "OpenAI no devolvió un token de sesión de voz. Revisa OPENAI_API_KEY y el acceso a Realtime."
    throw new Error(mapOpenAiVoiceErrorMessage(message))
  }

  return {
    value: data.value,
    expiresAt: data.expires_at ?? null,
    model: REALTIME_MODEL,
    date: informe.date,
  }
}
