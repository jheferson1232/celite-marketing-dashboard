"use server"

import { createServerAction } from "@/lib/server-action"
import {
  getMetaPaymentAlerts,
  type MetaPaymentAlertsResult,
} from "@/lib/services/meta/meta-account-payment-status"

export const getMetaPaymentAlertsAction = createServerAction(
  async (): Promise<MetaPaymentAlertsResult> => getMetaPaymentAlerts()
)
