import "server-only"

import { metaGraphPostJson } from "./comments/meta-graph-mutate"
import { metaGraphGet } from "./meta-graph-retry"
import { deleteMetaCacheKey } from "./meta-cache"
import { withMetaDashboardAccount } from "./meta-dashboard-account.server"
import { normalizeMetaId } from "./meta-ids"

export type InformeAdsetStatus = "ACTIVE" | "PAUSED"

/**
 * Apaga o activa un conjunto desde el Informe IA.
 * Comprueba antes que el conjunto pertenezca a la cuenta indicada.
 */
export async function setInformeAdsetStatus(input: {
  accountId: string
  adsetId: string
  status: InformeAdsetStatus
}): Promise<{ adsetId: string; status: InformeAdsetStatus }> {
  const token = process.env.META_ACCESS_TOKEN?.trim()
  if (!token) throw new Error("Falta META_ACCESS_TOKEN.")

  const accountId = input.accountId.replace(/^act_/i, "").trim()
  const adsetId = normalizeMetaId(input.adsetId)
  if (!accountId || !adsetId) throw new Error("Cuenta o conjunto inválido.")
  if (input.status !== "ACTIVE" && input.status !== "PAUSED") {
    throw new Error("Estado inválido.")
  }

  const url = new URL(`https://graph.facebook.com/v25.0/${adsetId}`)
  url.searchParams.set("access_token", token)
  url.searchParams.set("fields", "account_id")
  const adset = await metaGraphGet<{ account_id?: string }>(url.toString())
  if (adset.account_id?.replace(/^act_/i, "") !== accountId) {
    throw new Error("El conjunto no pertenece a la cuenta seleccionada.")
  }

  await metaGraphPostJson<{ success?: boolean }>(
    adsetId,
    { status: input.status },
    token
  )

  await withMetaDashboardAccount(accountId, async () => {
    deleteMetaCacheKey(`meta-informe:status:adset:${adsetId}`)
  })

  return { adsetId, status: input.status }
}
