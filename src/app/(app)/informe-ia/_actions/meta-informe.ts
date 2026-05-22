"use server"

import { createServerAction } from "@/lib/server-action"
import {
  getMetaInformePayload,
  setMetaIntentActive,
  syncMetaOperativeStateForDate,
  syncMetaTrackCatalog,
  getForgottenActivations,
} from "@/lib/services/meta/meta-operative-service"
import { generateActivationReminderCommentary } from "@/lib/services/meta/meta-cron-commentary"
import { getDashboardHour, getDashboardToday } from "@/lib/date"

export const getMetaInformeAction = createServerAction(
  async (days: number = 7) => getMetaInformePayload(days)
)

export const syncMetaInformeAction = createServerAction(async () => {
  await syncMetaTrackCatalog()
  await syncMetaOperativeStateForDate(getDashboardToday())
  return getMetaInformePayload(7)
})

export const setMetaIntentActiveAction = createServerAction(
  async ({
    entityId,
    intentActive,
  }: {
    entityId: string
    intentActive: boolean
  }) => {
    await setMetaIntentActive(entityId, intentActive)
    return getMetaInformePayload(7)
  }
)

export const getMetaInformeAiReminderAction = createServerAction(async () => {
  const forgotten = await getForgottenActivations()
  const hour = getDashboardHour()
  const text = await generateActivationReminderCommentary(forgotten, hour)
  return { text, forgottenCount: forgotten.length }
})
