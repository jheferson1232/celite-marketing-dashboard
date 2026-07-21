import prisma from "@/lib/prisma"
import { ServerActionError } from "@/lib/server-action"
import { getPenToCopRate } from "@/lib/format/pen-to-cop"
import {
  INFORME_ADSET_APAGAR_SPEND_COP,
  INFORME_CAMPAIGN_APAGAR_SPEND_COP,
  INFORME_CPA_PENALTY_COP,
} from "@/lib/services/meta/meta-informe-scoring"
import type { TikTokAgentThresholds } from "./types"

function copToPen(cop: number): number {
  const rate = getPenToCopRate()
  const pen = cop / rate
  return Math.round(pen * 100) / 100
}

export const DEFAULT_TIKTOK_AGENT_THRESHOLDS: TikTokAgentThresholds = {
  adsetPauseSpendPen: copToPen(INFORME_ADSET_APAGAR_SPEND_COP),
  campaignPauseSpendPen: copToPen(INFORME_CAMPAIGN_APAGAR_SPEND_COP),
  adsetCpaCriticoPen: copToPen(INFORME_CPA_PENALTY_COP),
  telegramNotify: true,
  activateAt6amEnabled: false,
  scaleBestEnabled: false,
  scaleBestBudgetIncreasePercent: 20,
}

function assertTikTokAgentPrisma() {
  if (!prisma.tikTokAgentSettings) {
    throw new ServerActionError(
      "Cliente Prisma desactualizado (falta TikTokAgentSettings). Redeploy en Vercel o reiniciá pnpm dev tras prisma generate."
    )
  }
}

export async function getTikTokAgentThresholds(): Promise<TikTokAgentThresholds> {
  assertTikTokAgentPrisma()
  const row = await prisma.tikTokAgentSettings.findUnique({
    where: { id: "default" },
  })
  if (!row) return { ...DEFAULT_TIKTOK_AGENT_THRESHOLDS }

  return {
    adsetPauseSpendPen: row.adsetPauseSpendPen,
    campaignPauseSpendPen: row.campaignPauseSpendPen,
    adsetCpaCriticoPen: row.adsetCpaCriticoPen,
    telegramNotify: row.telegramNotify,
    activateAt6amEnabled: row.activateAt6amEnabled,
    scaleBestEnabled: row.scaleBestEnabled,
    scaleBestBudgetIncreasePercent: row.scaleBestBudgetIncreasePercent,
  }
}

function assertValidPenThreshold(
  value: number | undefined,
  label: string
): number | undefined {
  if (value === undefined) return undefined
  if (!Number.isFinite(value) || value < 0) {
    throw new ServerActionError(
      `${label} debe ser un número ≥ 0 (en soles).`
    )
  }
  return Math.round(value * 100) / 100
}

function assertValidPercent(
  value: number | undefined,
  label: string
): number | undefined {
  if (value === undefined) return undefined
  if (!Number.isFinite(value) || value < 1 || value > 200) {
    throw new ServerActionError(`${label} debe ser un número entre 1 y 200.`)
  }
  return Math.round(value * 100) / 100
}

export async function saveTikTokAgentThresholds(
  input: Partial<TikTokAgentThresholds>
): Promise<TikTokAgentThresholds> {
  const current = await getTikTokAgentThresholds()
  const next: TikTokAgentThresholds = {
    adsetPauseSpendPen:
      assertValidPenThreshold(
        input.adsetPauseSpendPen,
        "Gasto conjunto sin compras"
      ) ?? current.adsetPauseSpendPen,
    campaignPauseSpendPen:
      assertValidPenThreshold(
        input.campaignPauseSpendPen,
        "Gasto campaña sin compras"
      ) ?? current.campaignPauseSpendPen,
    adsetCpaCriticoPen:
      assertValidPenThreshold(input.adsetCpaCriticoPen, "CPA crítico") ??
      current.adsetCpaCriticoPen,
    telegramNotify: input.telegramNotify ?? current.telegramNotify,
    activateAt6amEnabled:
      input.activateAt6amEnabled ?? current.activateAt6amEnabled,
    scaleBestEnabled: input.scaleBestEnabled ?? current.scaleBestEnabled,
    scaleBestBudgetIncreasePercent:
      assertValidPercent(
        input.scaleBestBudgetIncreasePercent,
        "% aumento presupuesto"
      ) ?? current.scaleBestBudgetIncreasePercent,
  }

  assertTikTokAgentPrisma()

  try {
    await prisma.tikTokAgentSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        ...next,
      },
      update: next,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al guardar umbrales"
    if (
      message.includes("TikTokAgentSettings") ||
      message.includes("does not exist") ||
      message.includes("adsetPauseSpendPen")
    ) {
      throw new ServerActionError(
        "Falta la tabla del agente TikTok en la base de datos. Ejecutá: pnpm prisma migrate deploy"
      )
    }
    throw error
  }

  return next
}
