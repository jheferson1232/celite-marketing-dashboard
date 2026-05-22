import { openai } from "@ai-sdk/openai"
import { generateText } from "ai"
import type { CampaignMultiWindowMetrics } from "./campaign-multi-window-metrics"
import {
  getCampaignMultiWindowMetricsForMetaIds,
  getEmptyCampaignMultiWindowMetrics,
} from "./campaign-multi-window-metrics"

type CampaignRowForAi = {
  metaId: string
  name: string
  metaWasActive: boolean
  spendToday: number
  purchasesToday: number
  cpaToday: number
  dayCells: { date: string; spend: number; purchases: number }[]
  estadoLabel: string
  rowHighlight: "none" | "red"
  estadoKind: string
}

export type InformeCampaignGroupForAi = {
  campaign: CampaignRowForAi
}

/** CPA máximo COP para recomendar seguir activando. */
export const CAMPAIGN_AI_CPA_MAX_COP = 20_000

export type CampaignAiVerdictInput = {
  metaId: string
  name: string
  metaOn: boolean
  today: { spend: number; purchases: number; cpa: number }
  yesterday: { spend: number; purchases: number; cpa: number }
  windows: CampaignMultiWindowMetrics
}

type AiVerdictJson = { metaId: string; label: string }

let verdictCache: { key: string; at: number; map: Map<string, string> } | null =
  null
const VERDICT_CACHE_TTL_MS = 6 * 60 * 60 * 1000

function getYesterdayMetrics(
  row: CampaignRowForAi,
  yesterday: string
): { spend: number; purchases: number; cpa: number } {
  const cell = row.dayCells.find((d) => d.date === yesterday)
  const spend = cell?.spend ?? 0
  const purchases = cell?.purchases ?? 0
  return {
    spend,
    purchases,
    cpa: purchases > 0 ? spend / purchases : 0,
  }
}

function buildInputs(
  groups: InformeCampaignGroupForAi[],
  yesterday: string,
  metricsByMetaId: Map<string, CampaignMultiWindowMetrics>
): CampaignAiVerdictInput[] {
  return groups.map((group) => {
    const c = group.campaign
    const windows =
      metricsByMetaId.get(c.metaId) ?? getEmptyCampaignMultiWindowMetrics()
    return {
      metaId: c.metaId,
      name: c.name,
      metaOn: c.metaWasActive,
      today: {
        spend: c.spendToday,
        purchases: c.purchasesToday,
        cpa: c.cpaToday,
      },
      yesterday: getYesterdayMetrics(c, yesterday),
      windows,
    }
  })
}

/** Regla fija cuando no hay OpenAI o falla el parseo. */
export function ruleBasedCampaignVerdict(input: CampaignAiVerdictInput): string {
  const { d7, d15, d30, total } = input.windows
  const maxCpa = CAMPAIGN_AI_CPA_MAX_COP

  const recentNoSales =
    (d7.spend >= 10_000 && d7.purchases === 0) ||
    (d15.spend >= 15_000 && d15.purchases === 0) ||
    (d30.spend >= 20_000 && d30.purchases === 0)

  if (recentNoSales) return "No seguir"

  const cpas = [d7, d15, d30].filter((w) => w.purchases > 0).map((w) => w.cpa)
  const worstRecent = cpas.length > 0 ? Math.max(...cpas) : 0

  if (worstRecent > maxCpa) return "No seguir"

  if (
    total.purchases > 0 &&
    total.cpa > maxCpa &&
    d7.purchases === 0 &&
    d7.spend < 5_000
  ) {
    return "No seguir"
  }

  if (d7.purchases > 0 && d7.cpa <= maxCpa) return "Seguir activando"
  if (d15.purchases > 0 && d15.cpa <= maxCpa) return "Seguir activando"
  if (total.purchases > 0 && total.cpa <= maxCpa) return "Seguir activando"

  if (d7.spend < 5_000 && d15.spend < 5_000) return "Revisar"

  return "Revisar"
}

function verdictCacheKey(inputs: CampaignAiVerdictInput[]): string {
  return inputs
    .map(
      (i) =>
        `${i.metaId}:${i.today.spend}:${i.today.purchases}:${i.windows.d7.cpa}:${i.windows.d30.cpa}`
    )
    .join("|")
}

function parseVerdictJson(text: string): Map<string, string> | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[0]) as {
      verdicts?: AiVerdictJson[]
    }
    if (!Array.isArray(parsed.verdicts)) return null
    const map = new Map<string, string>()
    for (const v of parsed.verdicts) {
      if (v.metaId && v.label) map.set(v.metaId, v.label.trim())
    }
    return map.size > 0 ? map : null
  } catch {
    return null
  }
}

async function resolveWithOpenAi(
  inputs: CampaignAiVerdictInput[]
): Promise<Map<string, string> | null> {
  if (!process.env.OPENAI_API_KEY?.trim() || inputs.length === 0) return null

  try {
    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      system: `Eres analista Meta Ads (Colombia, COP). Responde SOLO JSON válido:
{"verdicts":[{"metaId":"...","label":"..."}]}
Una entrada por campaña. label debe ser EXACTAMENTE uno de: "Seguir activando", "No seguir", "Revisar".
Criterio: CPA de campaña no debe superar ${CAMPAIGN_AI_CPA_MAX_COP} COP en ventanas recientes (7/15/30 días) para seguir.
Mucho gasto sin compras en 7-30d → "No seguir". Poco gasto → "Revisar".
No incluyas métricas en label, solo el veredicto.`,
      prompt: JSON.stringify(inputs, null, 2),
    })
    return parseVerdictJson(text.trim())
  } catch (error) {
    console.error("Campaign AI estado:", error)
    return null
  }
}

async function resolveCampaignAiVerdicts(
  inputs: CampaignAiVerdictInput[]
): Promise<Map<string, string>> {
  const key = verdictCacheKey(inputs)
  const now = Date.now()
  if (
    verdictCache &&
    verdictCache.key === key &&
    now - verdictCache.at < VERDICT_CACHE_TTL_MS
  ) {
    return verdictCache.map
  }

  const fromAi = await resolveWithOpenAi(inputs)
  const map = new Map<string, string>()

  for (const input of inputs) {
    const label =
      fromAi?.get(input.metaId) ?? ruleBasedCampaignVerdict(input)
    map.set(input.metaId, normalizeVerdictLabel(label))
  }

  verdictCache = { key, at: now, map }
  return map
}

function normalizeVerdictLabel(label: string): string {
  const lower = label.toLowerCase()
  if (lower.includes("no seguir") || lower.includes("pausar")) return "No seguir"
  if (lower.includes("seguir")) return "Seguir activando"
  return "Revisar"
}

function highlightForVerdict(label: string): "none" | "red" {
  return label === "No seguir" ? "red" : "none"
}

/** Sustituye estadoLabel en filas de campaña (conjuntos sin cambios). */
export async function applyCampaignAiEstadoLabels(
  groups: InformeCampaignGroupForAi[],
  yesterday: string
): Promise<void> {
  if (groups.length === 0) return

  const metaIds = groups.map((g) => g.campaign.metaId)
  let metricsByMetaId: Map<string, CampaignMultiWindowMetrics>
  try {
    metricsByMetaId = await getCampaignMultiWindowMetricsForMetaIds(metaIds)
  } catch (error) {
    console.error("Campaign multi-window metrics:", error)
    metricsByMetaId = new Map()
  }

  const inputs = buildInputs(groups, yesterday, metricsByMetaId)
  const verdicts = await resolveCampaignAiVerdicts(inputs)

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i]
    const input = inputs[i]
    const label =
      verdicts.get(group.campaign.metaId) ?? ruleBasedCampaignVerdict(input)
    group.campaign.estadoLabel = label
    group.campaign.rowHighlight = highlightForVerdict(label)
    group.campaign.estadoKind = "neutral"
  }
}
