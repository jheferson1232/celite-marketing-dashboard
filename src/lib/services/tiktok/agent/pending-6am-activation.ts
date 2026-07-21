import prisma from "@/lib/prisma"
import { ServerActionError } from "@/lib/server-action"
import { activateTikTokCampaignComplete } from "@/lib/services/tiktok/manage"
import { getTikTokAgentThresholds } from "./config"
import type { TikTokAgentPlannedAction } from "./types"

export type PendingActivateCampaign = {
  campaignId: string
  name: string
  queuedAt: string
}

function assertSettings() {
  if (!prisma.tikTokAgentSettings) {
    throw new ServerActionError(
      "Cliente Prisma desactualizado. Redeploy o reiniciá tras prisma generate."
    )
  }
}

function parsePending(raw: string | null | undefined): PendingActivateCampaign[] {
  if (!raw?.trim()) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null
        const row = item as Record<string, unknown>
        const campaignId =
          typeof row.campaignId === "string" ? row.campaignId.trim() : ""
        if (!campaignId) return null
        return {
          campaignId,
          name:
            typeof row.name === "string" && row.name.trim()
              ? row.name.trim()
              : campaignId,
          queuedAt:
            typeof row.queuedAt === "string" && row.queuedAt
              ? row.queuedAt
              : new Date().toISOString(),
        } satisfies PendingActivateCampaign
      })
      .filter((item): item is PendingActivateCampaign => item != null)
  } catch {
    return []
  }
}

async function readPendingRaw(): Promise<string> {
  assertSettings()
  const row = await prisma.tikTokAgentSettings.findUnique({
    where: { id: "default" },
  })
  return row?.pendingActivateCampaignIds ?? "[]"
}

async function writePending(items: PendingActivateCampaign[]): Promise<void> {
  assertSettings()
  await prisma.tikTokAgentSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      pendingActivateCampaignIds: JSON.stringify(items),
    },
    update: {
      pendingActivateCampaignIds: JSON.stringify(items),
    },
  })
}

export async function listPendingActivateCampaigns(): Promise<
  PendingActivateCampaign[]
> {
  const thresholds = await getTikTokAgentThresholds()
  // Si la feature está off, no tratar campañas como “en cola” en el dashboard
  // (evita switches bloqueados con etiqueta 6:00 AM).
  if (!thresholds.activateAt6amEnabled) return []
  return parsePending(await readPendingRaw())
}

/** Lista cruda de la cola (ignora si la feature está on/off). */
export async function listPendingActivateCampaignsRaw(): Promise<
  PendingActivateCampaign[]
> {
  return parsePending(await readPendingRaw())
}

export async function clearPendingActivateCampaigns(): Promise<void> {
  await writePending([])
}

export async function queueCampaignFor6amActivation(input: {
  campaignId: string
  name?: string
}): Promise<PendingActivateCampaign[]> {
  const campaignId = input.campaignId.trim()
  if (!campaignId) {
    throw new ServerActionError("Falta campaignId")
  }

  const current = parsePending(await readPendingRaw())
  if (current.some((item) => item.campaignId === campaignId)) {
    return current
  }

  const next = [
    ...current,
    {
      campaignId,
      name: input.name?.trim() || campaignId,
      queuedAt: new Date().toISOString(),
    },
  ]
  await writePending(next)
  return next
}

export async function removeCampaignFrom6amQueue(
  campaignId: string
): Promise<PendingActivateCampaign[]> {
  const id = campaignId.trim()
  const next = parsePending(await readPendingRaw()).filter(
    (item) => item.campaignId !== id
  )
  await writePending(next)
  return next
}

export async function isCampaignQueuedFor6am(
  campaignId: string
): Promise<boolean> {
  const pending = await listPendingActivateCampaigns()
  const id = campaignId.trim()
  return pending.some((item) => item.campaignId === id)
}

/**
 * A las 6:00: activa en TikTok todas las campañas en cola (campaña + conjuntos)
 * y deja registro en «Últimas corridas» (TikTokAgentRun / trigger morning_6am).
 */
export async function runPending6amActivations(input?: {
  dryRun?: boolean
}): Promise<{
  activated: number
  failed: number
  skippedFeatureOff: boolean
  runId: string | null
  details: Array<{ campaignId: string; name: string; ok: boolean; error?: string }>
}> {
  const dryRun = input?.dryRun ?? false
  const thresholds = await getTikTokAgentThresholds()
  const pending = parsePending(await readPendingRaw())

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
    actionsCount: number
  }) => {
    await prisma.tikTokAgentRun.update({
      where: { id: run.id },
      data: {
        status: data.status,
        finishedAt: new Date(),
        campaignsScanned: pending.length,
        actionsCount: data.actionsCount,
        summary: data.summary,
        errorMessage: data.errorMessage ?? null,
        actions: data.actions,
      },
    })
  }

  if (!thresholds.activateAt6amEnabled) {
    const details = pending.map((item) => ({
      campaignId: item.campaignId,
      name: item.name,
      ok: false,
      error: "Feature Activación 6:00 AM está apagada",
    }))
    const actions: TikTokAgentPlannedAction[] = details.map((item) => ({
      kind: "activate_campaign",
      entityId: item.campaignId,
      entityName: item.name,
      spendPen: 0,
      purchases: 0,
      cpaPen: 0,
      reason: "Cola 6:00 AM (feature apagada)",
      applied: false,
      error: item.error,
    }))
    await finishRun({
      status: "success",
      summary:
        pending.length === 0
          ? "Activación 6am omitida: la feature está apagada."
          : `Activación 6am omitida: feature apagada (${pending.length} en cola sin activar).`,
      actions,
      actionsCount: actions.length,
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
      actionsCount: 0,
    })
    return {
      activated: 0,
      failed: 0,
      skippedFeatureOff: false,
      runId: run.id,
      details: [],
    }
  }

  const details: Array<{
    campaignId: string
    name: string
    ok: boolean
    error?: string
  }> = []
  const remaining: PendingActivateCampaign[] = []

  for (const item of pending) {
    if (dryRun) {
      details.push({
        campaignId: item.campaignId,
        name: item.name,
        ok: true,
      })
      continue
    }

    try {
      await activateTikTokCampaignComplete(item.campaignId)
      details.push({
        campaignId: item.campaignId,
        name: item.name,
        ok: true,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error al activar"
      details.push({
        campaignId: item.campaignId,
        name: item.name,
        ok: false,
        error: message,
      })
      remaining.push(item)
    }
  }

  if (!dryRun) {
    await writePending(remaining)
  }

  const activated = details.filter((d) => d.ok).length
  const failed = details.filter((d) => !d.ok).length
  const actions: TikTokAgentPlannedAction[] = details.map((item) => ({
    kind: "activate_campaign",
    entityId: item.campaignId,
    entityName: item.name,
    spendPen: 0,
    purchases: 0,
    cpaPen: 0,
    reason: dryRun
      ? "Simulación activación 6:00 AM"
      : "Activación programada 6:00 AM (Lima)",
    applied: !dryRun && item.ok,
    error: item.error,
  }))

  await finishRun({
    status: failed > 0 && activated === 0 ? "failed" : "success",
    summary: dryRun
      ? `${activated} campaña(s) en cola (dry run).`
      : `Activación 6am: ${activated} ok, ${failed} fallida(s).`,
    errorMessage:
      failed > 0 && activated === 0
        ? "Ninguna campaña de la cola se pudo activar."
        : undefined,
    actions,
    actionsCount: actions.length,
  })

  return {
    activated,
    failed,
    skippedFeatureOff: false,
    runId: run.id,
    details,
  }
}
