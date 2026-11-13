import { NextResponse } from "next/server"
import {
  isDryRun,
  isValidCronRequest,
  unauthorizedCronResponse,
} from "@/lib/cron-auth"
import prisma from "@/lib/prisma"
import { getTikTokAgentThresholds } from "@/lib/services/tiktok/agent/config"
import {
  listPendingActivateCampaignsRaw,
  writePendingActivateCampaigns,
  type PendingActivateCampaign,
} from "@/lib/services/tiktok/agent/pending-6am-activation"
import type { TikTokAgentPlannedAction } from "@/lib/services/tiktok/agent/types"
import { activateTikTokCampaignComplete } from "@/lib/services/tiktok/manage"

export const dynamic = "force-dynamic"
export const maxDuration = 300

type ActivationDetail = {
  campaignId: string
  name: string
  ok: boolean
  error?: string
}

/**
 * 6:00 Lima (schedule `tiktok-activate-6am`): activa en TikTok las campañas en
 * cola (campaña + conjuntos) y deja registro en «Últimas corridas»
 * (TikTokAgentRun / trigger morning_6am).
 */
export async function GET(request: Request) {
  if (!isValidCronRequest(request)) return unauthorizedCronResponse()

  const dryRun = isDryRun(request)

  try {
    const result = await runPendingActivations(dryRun)
    return NextResponse.json({
      ok: true,
      trigger: "morning_6am",
      dryRun,
      ...result,
    })
  } catch (error) {
    console.error("TikTok activate 6am cron:", error)
    const message =
      error instanceof Error ? error.message : "Error en cron activación 6am"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

async function runPendingActivations(dryRun: boolean) {
  const thresholds = await getTikTokAgentThresholds()
  const pending = await listPendingActivateCampaignsRaw()

  const run = await prisma.tikTokAgentRun.create({
    data: {
      trigger: "morning_6am",
      status: "running",
      dryRun,
      accountsScanned: 1,
      campaignsScanned: pending.length,
    },
  })

  const finishRun = async (data: {
    status: "success" | "failed"
    summary: string
    errorMessage?: string
    actions: TikTokAgentPlannedAction[]
  }) => {
    await prisma.tikTokAgentRun.update({
      where: { id: run.id },
      data: {
        status: data.status,
        finishedAt: new Date(),
        campaignsScanned: pending.length,
        actionsCount: data.actions.length,
        summary: data.summary,
        errorMessage: data.errorMessage ?? null,
        actions: data.actions,
      },
    })
  }

  if (!thresholds.activateAt6amEnabled) {
    const details: ActivationDetail[] = pending.map((item) => ({
      campaignId: item.campaignId,
      name: item.name,
      ok: false,
      error: "Feature Activación 6:00 AM está apagada",
    }))
    await finishRun({
      status: "success",
      summary:
        pending.length === 0
          ? "Activación 6am omitida: la feature está apagada."
          : `Activación 6am omitida: feature apagada (${pending.length} en cola sin activar).`,
      actions: details.map((item) =>
        toPlannedAction(item, "Cola 6:00 AM (feature apagada)", false)
      ),
    })
    return {
      activated: 0,
      failed: 0,
      skippedFeatureOff: true,
      runId: run.id,
      details,
    }
  }

  if (pending.length === 0) {
    await finishRun({
      status: "success",
      summary: "Activación 6am: cola vacía, nada que encender.",
      actions: [],
    })
    return {
      activated: 0,
      failed: 0,
      skippedFeatureOff: false,
      runId: run.id,
      details: [],
    }
  }

  const details: ActivationDetail[] = []
  const remaining: PendingActivateCampaign[] = []

  for (const item of pending) {
    if (dryRun) {
      details.push({ campaignId: item.campaignId, name: item.name, ok: true })
      continue
    }

    try {
      await activateTikTokCampaignComplete(item.campaignId)
      details.push({ campaignId: item.campaignId, name: item.name, ok: true })
    } catch (error) {
      details.push({
        campaignId: item.campaignId,
        name: item.name,
        ok: false,
        error: error instanceof Error ? error.message : "Error al activar",
      })
      remaining.push(item)
    }
  }

  if (!dryRun) {
    await writePendingActivateCampaigns(remaining)
  }

  const activated = details.filter((d) => d.ok).length
  const failed = details.filter((d) => !d.ok).length
  const reason = dryRun
    ? "Simulación activación 6:00 AM"
    : "Activación programada 6:00 AM (Lima)"

  await finishRun({
    status: failed > 0 && activated === 0 ? "failed" : "success",
    summary: dryRun
      ? `${activated} campaña(s) en cola (dry run).`
      : `Activación 6am: ${activated} ok, ${failed} fallida(s).`,
    errorMessage:
      failed > 0 && activated === 0
        ? "Ninguna campaña de la cola se pudo activar."
        : undefined,
    actions: details.map((item) =>
      toPlannedAction(item, reason, !dryRun && item.ok)
    ),
  })

  return {
    activated,
    failed,
    skippedFeatureOff: false,
    runId: run.id,
    details,
  }
}

function toPlannedAction(
  item: ActivationDetail,
  reason: string,
  applied: boolean
): TikTokAgentPlannedAction {
  return {
    kind: "activate_campaign",
    entityId: item.campaignId,
    entityName: item.name,
    spendPen: 0,
    purchases: 0,
    cpaPen: 0,
    reason,
    applied,
    error: item.error,
  }
}
