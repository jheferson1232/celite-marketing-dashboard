"use server"

import { revalidatePath, revalidateTag, updateTag } from "next/cache"
import { createServerAction } from "@/lib/create-server-action"
import { META_DATA_CACHE_TAG } from "@/lib/services/meta/meta-graph-fetch"
import {
  getMetaInformePayload,
  setInformeCpaTarget,
} from "@/lib/services/meta/meta-operative-service"
import {
  buildMetaHourlyReportPayload,
  buildMetaHourlyTelegramMessage,
  sendMetaHourlyReportToTelegram,
} from "@/lib/services/meta/meta-hourly-report"
import { getInformeAdsetAds } from "@/lib/services/meta/meta-informe-ads"
import {
  setInformeAdsetStatus,
  type InformeAdsetStatus,
} from "@/lib/services/meta/meta-informe-adset-status"

export const getMetaInformeAction = createServerAction(
  async (accountId: string) => getMetaInformePayload({ accountId })
)

/** Invalida la caché de Graph API (tag meta-data) y la ruta del informe. */
function invalidateMetaGraphCache() {
  updateTag(META_DATA_CACHE_TAG)
  revalidateTag(META_DATA_CACHE_TAG, { expire: 0 })
  revalidatePath("/informe-ia")
}

export const revalidateMetaDataAction = createServerAction(async () => {
  invalidateMetaGraphCache()
})

export const syncMetaInformeAction = createServerAction(
  async (accountId: string) => {
    invalidateMetaGraphCache()
    return getMetaInformePayload({ accountId })
  }
)

/** Anuncios de un conjunto (se cargan al desplegarlo en la tabla). */
export const getInformeAdsetAdsAction = createServerAction(
  async (input: { accountId: string; adsetId: string }) =>
    getInformeAdsetAds(input)
)

export const setInformeCpaTargetAction = createServerAction(
  async (input: { accountId: string; cpaTarget: number }) =>
    setInformeCpaTarget(input)
)

/** Apaga o activa un conjunto desde «Qué hacer ahora». */
export const setInformeAdsetStatusAction = createServerAction(
  async (input: {
    accountId: string
    adsetId: string
    status: InformeAdsetStatus
  }) => {
    const result = await setInformeAdsetStatus(input)
    invalidateMetaGraphCache()
    return result
  }
)

/** Vista previa del informe de Telegram (todas las cuentas, sin enviar). */
export const previewMetaInformeHourlyAction = createServerAction(async () => {
  const payload = await buildMetaHourlyReportPayload()
  return { text: await buildMetaHourlyTelegramMessage(payload) }
})

/** Envía el informe a los chats configurados en Telegram. */
export const sendMetaInformeHourlyToTelegramAction = createServerAction(
  async () => {
    const result = await sendMetaHourlyReportToTelegram(undefined, {
      skipDedup: true,
    })
    return { text: result.message, sent: result.sent }
  }
)
