import prisma from "@/lib/prisma"
import { getTodayDateRange } from "@/lib/date"
import { getTikTokCampaignsList } from "@/lib/services/tiktok/campaigns-list"
import { getTikTokAdSetsGroupedByCampaign } from "@/lib/services/tiktok/campaign-adgroups"
import {
  getTikTokAdGroupDailyBudget,
  pauseTikTokCampaignComplete,
  updateTikTokAdGroupBudget,
  updateTikTokAdGroupStatus,
} from "@/lib/services/tiktok/manage"
import { getTikTokAgentThresholds } from "./config"
import { planTikTokAgentActions } from "./rules"
import { planScaleBestAdGroup } from "./scale-best"
import {
  sendTikTokAgentTelegramSummary,
  sendTikTokScaleBudgetTelegram,
} from "./telegram"
import type {
  TikTokAgentPlannedAction,
  TikTokAgentRunSummary,
  TikTokAgentTrigger,
} from "./types"

function parseActions(json: unknown): TikTokAgentPlannedAction[] {
  if (!Array.isArray(json)) return []
  return json as TikTokAgentPlannedAction[]
}

function toRunSummary(row: {
  id: string
  trigger: string
  status: string
  dryRun: boolean
  startedAt: Date
  finishedAt: Date | null
  accountsScanned: number
  campaignsScanned: number
  adgroupsScanned: number
  actionsCount: number
  summary: string | null
  errorMessage: string | null
  actions: unknown
}): TikTokAgentRunSummary {
  return {
    runId: row.id,
    trigger: row.trigger as TikTokAgentTrigger,
    status: row.status as TikTokAgentRunSummary["status"],
    dryRun: row.dryRun,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    accountsScanned: row.accountsScanned,
    campaignsScanned: row.campaignsScanned,
    adgroupsScanned: row.adgroupsScanned,
    actionsCount: row.actionsCount,
    summary: row.summary,
    errorMessage: row.errorMessage,
    actions: parseActions(row.actions),
  }
}

async function applyAction(
  action: TikTokAgentPlannedAction,
  dryRun: boolean
): Promise<TikTokAgentPlannedAction> {
  if (dryRun) {
    return { ...action, applied: false }
  }

  try {
    if (action.kind === "pause_campaign") {
      await pauseTikTokCampaignComplete(action.entityId)
    } else if (action.kind === "scale_adgroup") {
      const liveBudget = await getTikTokAdGroupDailyBudget(action.entityId)
      const before = liveBudget ?? action.budgetBeforePen ?? null
      if (before == null || before < 1) {
        return {
          ...action,
          applied: false,
          error: "Sin presupuesto diario editable",
        }
      }
      const percent = action.budgetIncreasePercent ?? 0
      const after =
        action.budgetAfterPen ??
        Math.round(before * (1 + percent / 100) * 100) / 100
      await updateTikTokAdGroupBudget(action.entityId, after)
      return {
        ...action,
        budgetBeforePen: before,
        budgetAfterPen: after,
        applied: true,
      }
    } else {
      await updateTikTokAdGroupStatus([action.entityId], "DISABLE")
    }
    return { ...action, applied: true }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al aplicar acción"
    return { ...action, applied: false, error: message }
  }
}

export async function listTikTokAgentRuns(limit = 20): Promise<TikTokAgentRunSummary[]> {
  const rows = await prisma.tikTokAgentRun.findMany({
    orderBy: { startedAt: "desc" },
    take: limit,
  })
  return rows.map(toRunSummary)
}

export async function getTikTokAgentRun(
  runId: string
): Promise<TikTokAgentRunSummary | null> {
  const row = await prisma.tikTokAgentRun.findUnique({ where: { id: runId } })
  return row ? toRunSummary(row) : null
}

export async function runTikTokAgent(input: {
  trigger: TikTokAgentTrigger
  dryRun: boolean
}): Promise<TikTokAgentRunSummary> {
  const thresholds = await getTikTokAgentThresholds()
  const run = await prisma.tikTokAgentRun.create({
    data: {
      trigger: input.trigger,
      status: "running",
      dryRun: input.dryRun,
      accountsScanned: 1,
    },
  })

  try {
    const dateRange = getTodayDateRange()
    const [campaigns, adsetsByCampaign] = await Promise.all([
      getTikTokCampaignsList(dateRange),
      getTikTokAdSetsGroupedByCampaign(dateRange),
    ])

    const adgroupsScanned = Object.values(adsetsByCampaign).reduce(
      (sum, list) => sum + list.length,
      0
    )

    const planned = planTikTokAgentActions({
      campaigns,
      adsetsByCampaign,
      thresholds,
    })

    const excludeFromScale = new Set(
      planned.flatMap((action) => {
        if (action.kind === "pause_campaign" || action.kind === "pause_adgroup") {
          return [action.entityId]
        }
        return []
      })
    )

    const scalePlan = planScaleBestAdGroup({
      campaigns,
      adsetsByCampaign,
      thresholds,
      excludeEntityIds: excludeFromScale,
    })

    const executed: TikTokAgentPlannedAction[] = []
    for (const action of planned) {
      executed.push(await applyAction(action, input.dryRun))
    }
    if (scalePlan) {
      executed.push(await applyAction(scalePlan, input.dryRun))
    }

    const appliedCount = executed.filter((a) => a.applied).length
    const pauseCount = executed.filter(
      (a) => a.kind === "pause_adgroup" || a.kind === "pause_campaign"
    ).length
    const scaleCount = executed.filter((a) => a.kind === "scale_adgroup").length
    const summary =
      executed.length === 0
        ? "Sin acciones: ninguna campaña/conjunto activo superó los umbrales hoy."
        : input.dryRun
          ? `${pauseCount} pausa(s) y ${scaleCount} escalado(s) sugerido(s) (dry run).`
          : `${appliedCount} de ${executed.length} acción(es) aplicada(s) en TikTok.`

    await sendTikTokAgentTelegramSummary({
      trigger: input.trigger,
      dryRun: input.dryRun,
      campaignsScanned: campaigns.length,
      adgroupsScanned,
      actions: executed,
      thresholds,
    })

    const scaled = executed.find(
      (a) => a.kind === "scale_adgroup" && (a.applied || input.dryRun)
    )
    if (scaled) {
      await sendTikTokScaleBudgetTelegram({
        action: scaled,
        dryRun: input.dryRun,
        thresholds,
      })
    }

    const finished = await prisma.tikTokAgentRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        campaignsScanned: campaigns.length,
        adgroupsScanned,
        actionsCount: executed.length,
        summary,
        actions: executed,
      },
    })

    return toRunSummary(finished)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error en agente TikTok"
    const failed = await prisma.tikTokAgentRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        errorMessage: message,
      },
    })
    return toRunSummary(failed)
  }
}

/** Evita corridas duplicadas del mismo trigger en la misma ventana horaria. */
export async function shouldSkipScheduledTikTokAgentRun(
  trigger: TikTokAgentTrigger
): Promise<boolean> {
  if (trigger === "manual") return false

  const since = new Date(Date.now() - 50 * 60 * 1000)
  const recent = await prisma.tikTokAgentRun.findFirst({
    where: {
      trigger,
      status: "success",
      startedAt: { gte: since },
    },
    orderBy: { startedAt: "desc" },
  })
  return recent != null
}
