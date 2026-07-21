import { tool } from "ai"
import { z } from "zod"
import { wrapAccountKpis } from "@/lib/chat/kpi-response"
import {
  findTikTokAdGroupsByName,
  findTikTokCampaignsByName,
  formatTikTokAdGroupForAssistant,
  formatTikTokCampaignForAssistant,
} from "@/lib/chat/tiktok-tool-helpers"
import { getAccountKpis } from "@/lib/services/meta/account-kpis"
import { getCampaignAdSetsByCampaignId } from "@/lib/services/meta/campaign-adsets"
import { getCampaignsList } from "@/lib/services/meta/campaigns-list"
import { getTikTokAccountKpis } from "@/lib/services/tiktok/account-kpis"
import { getTikTokCampaignAdGroupsByCampaignId } from "@/lib/services/tiktok/campaign-adgroups"
import { getTikTokCampaignsList } from "@/lib/services/tiktok/campaigns-list"
import { applyTikTokCampaignStatusWith6amQueue } from "@/lib/services/tiktok/apply-campaign-status-6am"
import {
  getTikTokAdGroupDailyBudget,
  getTikTokCampaignDailyBudget,
  updateTikTokAdGroupBudget,
  updateTikTokAdGroupStatus,
  updateTikTokCampaignBudget,
} from "@/lib/services/tiktok/manage"
const dateRangeSchema = z.object({
  from: z.string().describe("Fecha inicio en formato YYYY-MM-DD"),
  to: z.string().describe("Fecha fin en formato YYYY-MM-DD"),
})

const confirmedSchema = z.object({
  confirmed: z
    .boolean()
    .describe(
      "Debe ser true solo después de que el usuario confirmó explícitamente (sí, confirmo, adelante, hazlo)."
    ),
})

function requireConfirmation(confirmed: boolean) {
  if (!confirmed) {
    return {
      error:
        "Acción no ejecutada: resume el cambio (nombre, ID, monto en PEN) y pide confirmación. Luego llama de nuevo con confirmed=true.",
      needsConfirmation: true,
    }
  }
  return null
}

function toolError(error: unknown, fallback: string) {
  return {
    error: error instanceof Error ? error.message : fallback,
  }
}

export const chatTools = {
  getMetaAccountKpis: tool({
    description:
      "KPIs de la cuenta Meta Ads (Facebook/Instagram) para un rango de fechas. Moneda: COP (pesos colombianos, símbolo $). Incluye gasto, impresiones, clics, CTR, CPA, CPM, compras y ROAS.",
    inputSchema: dateRangeSchema,
    execute: async ({ from, to }) => {
      try {
        const kpis = await getAccountKpis({ from, to })
        return wrapAccountKpis("meta", kpis)
      } catch (error) {
        return toolError(error, "Error al obtener KPIs de Meta")
      }
    },
  }),

  getTikTokAccountKpis: tool({
    description:
      "KPIs de la cuenta TikTok Ads para un rango de fechas. Moneda: PEN (soles peruanos, símbolo S/). Incluye gasto, impresiones, clics, CTR, CPA, CPM, compras y ROAS.",
    inputSchema: dateRangeSchema,
    execute: async ({ from, to }) => {
      try {
        const kpis = await getTikTokAccountKpis({ from, to })
        return wrapAccountKpis("tiktok", kpis)
      } catch (error) {
        return toolError(error, "Error al obtener KPIs de TikTok")
      }
    },
  }),

  getMetaCampaigns: tool({
    description:
      "Lista campañas de Meta Ads con métricas (gasto en COP). Útil para comparar rendimiento entre campañas de Facebook/Instagram.",
    inputSchema: dateRangeSchema,
    execute: async ({ from, to }) => {
      try {
        const campaigns = await getCampaignsList({ from, to })
        return {
          platform: "meta",
          currency: "COP",
          currencyLabel: "pesos colombianos (COP)",
          campaigns,
        }
      } catch (error) {
        return toolError(error, "Error al obtener campañas de Meta")
      }
    },
  }),

  getTikTokCampaigns: tool({
    description:
      "Lista TODAS las campañas TikTok con campaignId, nombre, estado (operationStatus ENABLE/DISABLE), presupuesto diario PEN (dailyBudgetPen) y gasto. OBLIGATORIO antes de pausar, activar o cambiar presupuesto de campaña. Si el usuario da un nombre parcial, usa searchTikTokEntities.",
    inputSchema: dateRangeSchema,
    execute: async ({ from, to }) => {
      try {
        const campaigns = await getTikTokCampaignsList({ from, to })
        return {
          platform: "tiktok",
          currency: "PEN",
          currencyLabel: "soles peruanos (PEN)",
          campaigns: campaigns.map(formatTikTokCampaignForAssistant),
        }
      } catch (error) {
        return toolError(error, "Error al obtener campañas de TikTok")
      }
    },
  }),

  searchTikTokEntities: tool({
    description:
      "Busca campañas o conjuntos TikTok por nombre (texto parcial). Devuelve IDs para pausar, activar o cambiar presupuesto. Si hay varias coincidencias, pide al usuario que elija.",
    inputSchema: dateRangeSchema.extend({
      nameQuery: z
        .string()
        .describe("Fragmento del nombre, ej: 'urbano', 'preto'"),
      campaignId: z
        .string()
        .optional()
        .describe(
          "Si se conoce la campaña, filtra conjuntos solo de esa campaña"
        ),
    }),
    execute: async ({ from, to, nameQuery, campaignId }) => {
      try {
        const campaigns = await getTikTokCampaignsList({ from, to })
        const matchedCampaigns = findTikTokCampaignsByName(campaigns, nameQuery)

        let matchedAdGroups: ReturnType<typeof formatTikTokAdGroupForAssistant>[] =
          []

        if (campaignId) {
          const adGroups = await getTikTokCampaignAdGroupsByCampaignId(
            campaignId,
            { from, to }
          )
          matchedAdGroups = findTikTokAdGroupsByName(adGroups, nameQuery)
        } else if (matchedCampaigns.length === 1) {
          const adGroups = await getTikTokCampaignAdGroupsByCampaignId(
            matchedCampaigns[0]!.campaignId,
            { from, to }
          )
          matchedAdGroups = findTikTokAdGroupsByName(adGroups, nameQuery)
        }

        return {
          platform: "tiktok",
          currency: "PEN",
          nameQuery,
          campaigns: matchedCampaigns,
          adGroups: matchedAdGroups,
        }
      } catch (error) {
        return toolError(error, "Error al buscar en TikTok")
      }
    },
  }),

  getMetaCampaignAdSets: tool({
    description:
      "Conjuntos de anuncios (ad sets) de una campaña de Meta Ads con métricas en COP.",
    inputSchema: dateRangeSchema.extend({
      campaignId: z.string().describe("ID de la campaña en Meta Ads"),
      objective: z
        .string()
        .describe(
          "Objetivo de la campaña, ej: OUTCOME_SALES, OUTCOME_LEADS, OUTCOME_TRAFFIC"
        ),
    }),
    execute: async ({ campaignId, from, to, objective }) => {
      try {
        const adSets = await getCampaignAdSetsByCampaignId(
          campaignId,
          { from, to },
          objective
        )
        return {
          platform: "meta",
          currency: "COP",
          adSets,
        }
      } catch (error) {
        return toolError(error, "Error al obtener conjuntos de Meta")
      }
    },
  }),

  getTikTokCampaignAdGroups: tool({
    description:
      "Conjuntos (ad groups) de una campaña TikTok con adgroupId, nombre, dailyBudgetPen y estado. Usar antes de cambiar presupuesto a nivel conjunto (lo más común en TikTok).",
    inputSchema: dateRangeSchema.extend({
      campaignId: z.string().describe("ID de la campaña en TikTok (campaignId)"),
    }),
    execute: async ({ campaignId, from, to }) => {
      try {
        const adGroups = await getTikTokCampaignAdGroupsByCampaignId(
          campaignId,
          { from, to }
        )
        return {
          platform: "tiktok",
          currency: "PEN",
          campaignId,
          adGroups: adGroups.map(formatTikTokAdGroupForAssistant),
        }
      } catch (error) {
        return toolError(error, "Error al obtener conjuntos de TikTok")
      }
    },
  }),

  setTikTokCampaignStatus: tool({
    description:
      "Enciende o apaga SOLO la campaña TikTok (no cambia el estado de los conjuntos). Para prender/apagar un conjunto usa setTikTokAdGroupStatus. ENABLE=activar campaña; DISABLE=pausar campaña.",
    inputSchema: confirmedSchema.extend({
      campaignId: z.string().describe("campaignId de getTikTokCampaigns"),
      campaignName: z
        .string()
        .optional()
        .describe("Nombre legible para confirmar con el usuario"),
      operationStatus: z.enum(["ENABLE", "DISABLE"]),
    }),
    execute: async ({
      campaignId,
      campaignName,
      operationStatus,
      confirmed,
    }) => {
      const block = requireConfirmation(confirmed)
      if (block) return block

      try {
        const result = await applyTikTokCampaignStatusWith6amQueue({
          campaignId,
          name: campaignName,
          operationStatus,
        })

        if (result.scheduledFor6am) {
          return {
            ok: true,
            verified: true,
            platform: "tiktok",
            campaignId,
            campaignName: campaignName ?? null,
            operationStatus: "DISABLE",
            scheduledFor6am: true,
            message:
              result.message ??
              `Campaña ${campaignName ? `"${campaignName}" ` : ""}en cola para activarse a las 6:00 AM (Lima). No se encendió en TikTok ahora.`,
          }
        }

        const action =
          operationStatus === "DISABLE" ? "pausada/apagada" : "activada/encendida"
        return {
          ok: true,
          verified: true,
          platform: "tiktok",
          campaignId,
          campaignName: campaignName ?? null,
          operationStatus,
          scheduledFor6am: false,
          message: `Campaña ${campaignName ? `"${campaignName}" ` : ""}${action} en TikTok.`,
        }
      } catch (error) {
        return toolError(error, "Error al actualizar estado de campaña TikTok")
      }
    },
  }),

  setTikTokAdGroupStatus: tool({
    description:
      "Enciende (ENABLE) o apaga/pausa (DISABLE) un conjunto TikTok por adgroupId.",
    inputSchema: confirmedSchema.extend({
      adgroupId: z.string().describe("adgroupId de getTikTokCampaignAdGroups"),
      adgroupName: z.string().optional(),
      operationStatus: z.enum(["ENABLE", "DISABLE"]),
    }),
    execute: async ({
      adgroupId,
      adgroupName,
      operationStatus,
      confirmed,
    }) => {
      const block = requireConfirmation(confirmed)
      if (block) return block

      try {
        await updateTikTokAdGroupStatus([adgroupId], operationStatus)
        const action =
          operationStatus === "DISABLE" ? "pausado/apagado" : "activado/encendido"
        return {
          ok: true,
          platform: "tiktok",
          adgroupId,
          adgroupName: adgroupName ?? null,
          operationStatus,
          message: `Conjunto ${adgroupName ? `"${adgroupName}" ` : ""}${action} en TikTok.`,
        }
      } catch (error) {
        return toolError(error, "Error al actualizar estado del conjunto TikTok")
      }
    },
  }),

  setTikTokAdGroupBudget: tool({
    description:
      "Establece el presupuesto diario exacto (PEN) de un conjunto TikTok. Para aumentar en % usa adjustTikTokBudget.",
    inputSchema: confirmedSchema.extend({
      adgroupId: z.string(),
      adgroupName: z.string().optional(),
      budget: z.number().positive().describe("Nuevo presupuesto diario en PEN"),
    }),
    execute: async ({ adgroupId, adgroupName, budget, confirmed }) => {
      const block = requireConfirmation(confirmed)
      if (block) return block

      try {
        await updateTikTokAdGroupBudget(adgroupId, budget)
        return {
          ok: true,
          platform: "tiktok",
          adgroupId,
          adgroupName: adgroupName ?? null,
          budget,
          currency: "PEN",
          message: `Presupuesto de ${adgroupName ? `"${adgroupName}" ` : "conjunto "}actualizado a S/ ${budget.toFixed(2)} PEN/día.`,
        }
      } catch (error) {
        return toolError(error, "Error al actualizar presupuesto del conjunto")
      }
    },
  }),

  setTikTokCampaignBudget: tool({
    description:
      "Establece presupuesto diario (PEN) de campaña TikTok solo si budgetMode es BUDGET_MODE_DAY (CBO). Si no, usa setTikTokAdGroupBudget en los conjuntos.",
    inputSchema: confirmedSchema.extend({
      campaignId: z.string(),
      campaignName: z.string().optional(),
      budget: z.number().positive(),
    }),
    execute: async ({ campaignId, campaignName, budget, confirmed }) => {
      const block = requireConfirmation(confirmed)
      if (block) return block

      try {
        await updateTikTokCampaignBudget(campaignId, budget)
        return {
          ok: true,
          platform: "tiktok",
          campaignId,
          campaignName: campaignName ?? null,
          budget,
          currency: "PEN",
          message: `Presupuesto de campaña ${campaignName ? `"${campaignName}" ` : ""}actualizado a S/ ${budget.toFixed(2)} PEN/día.`,
        }
      } catch (error) {
        return toolError(error, "Error al actualizar presupuesto de campaña")
      }
    },
  }),

  adjustTikTokBudget: tool({
    description:
      "Aumenta o reduce el presupuesto diario TikTok en porcentaje o monto fijo (PEN). Lee el presupuesto actual de la API. targetType adgroup es lo habitual.",
    inputSchema: confirmedSchema.extend({
      targetType: z.enum(["campaign", "adgroup"]),
      targetId: z.string().describe("campaignId o adgroupId"),
      targetName: z.string().optional(),
      changeType: z.enum(["percent", "fixed_amount"]),
      changeValue: z
        .number()
        .describe(
          "Si percent: ej 20 = +20%. Si fixed_amount: ej 10 = +S/10 (negativo para reducir)"
        ),
    }),
    execute: async ({
      targetType,
      targetId,
      targetName,
      changeType,
      changeValue,
      confirmed,
    }) => {
      const block = requireConfirmation(confirmed)
      if (block) return block

      try {
        const current =
          targetType === "campaign"
            ? await getTikTokCampaignDailyBudget(targetId)
            : await getTikTokAdGroupDailyBudget(targetId)

        if (current == null || current <= 0) {
          return {
            error:
              "Este objetivo no tiene presupuesto diario editable (probablemente presupuesto en otro nivel). Lista conjuntos con getTikTokCampaignAdGroups.",
          }
        }

        const delta =
          changeType === "percent"
            ? current * (changeValue / 100)
            : changeValue
        const newBudget = Math.round((current + delta) * 100) / 100

        if (newBudget < 1) {
          return {
            error: `El nuevo presupuesto sería S/ ${newBudget}. Mínimo S/ 1.`,
          }
        }

        if (targetType === "campaign") {
          await updateTikTokCampaignBudget(targetId, newBudget)
        } else {
          await updateTikTokAdGroupBudget(targetId, newBudget)
        }

        return {
          ok: true,
          platform: "tiktok",
          targetType,
          targetId,
          targetName: targetName ?? null,
          previousBudgetPen: current,
          newBudgetPen: newBudget,
          currency: "PEN",
          message: `${targetName ? `"${targetName}"` : "Objetivo"}: presupuesto S/ ${current.toFixed(2)} → S/ ${newBudget.toFixed(2)} PEN/día (${changeType === "percent" ? `${changeValue > 0 ? "+" : ""}${changeValue}%` : `${changeValue > 0 ? "+" : ""}S/ ${changeValue}`}).`,
        }
      } catch (error) {
        return toolError(error, "Error al ajustar presupuesto TikTok")
      }
    },
  }),
}
