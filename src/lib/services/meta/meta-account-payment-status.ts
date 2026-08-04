import "server-only"

import {
  type CurrencyCode,
  META_DASHBOARD_CURRENCY,
} from "@/lib/format"
import {
  assertMetaEnvConfigured,
  isMetaEnvConfigured,
} from "./meta-env"
import {
  isMetaRateLimitMessage,
  isMetaRateLimitStatus,
  metaGraphErrorMessage,
} from "./meta-errors"
import { buildMetaGraphUrl } from "./meta-graph-fetch"
import { withMetaCache } from "./meta-cache"
import type {
  MetaPaymentAlertsResult,
  MetaPaymentIssue,
} from "./meta-account-payment-types"

export type {
  MetaPaymentAlertsResult,
  MetaPaymentIssue,
  MetaPaymentIssueKind,
} from "./meta-account-payment-types"

const PAYMENT_STATUS_TTL_MS = 60_000
const MAX_RETRIES = 3
const BASE_DELAY_MS = 1_000

/** Meta Marketing API — account_status */
const ACCOUNT_STATUS = {
  ACTIVE: 1,
  DISABLED: 2,
  UNSETTLED: 3,
  PENDING_RISK_REVIEW: 7,
  PENDING_SETTLEMENT: 8,
  IN_GRACE_PERIOD: 9,
} as const

/** Meta Marketing API — disable_reason */
const DISABLE_REASON = {
  NONE: 0,
  RISK_PAYMENT: 3,
} as const

type MetaAdAccountPaymentFields = {
  id?: string
  account_id?: string
  name?: string
  account_status?: number
  disable_reason?: number
  balance?: string
  currency?: string
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function toCurrencyCode(value: string | null | undefined): CurrencyCode {
  const upper = value?.trim().toUpperCase()
  if (upper === "COP") return "COP"
  if (upper === "MXN" || upper === "MX") return "MX"
  if (upper === "PEN") return "PEN"
  return META_DASHBOARD_CURRENCY
}

/** Offset de moneda Meta (centavos). COP y JPY usan unidades enteras. */
function currencyOffset(currency: string | null | undefined): number {
  const upper = currency?.trim().toUpperCase()
  if (upper === "COP" || upper === "JPY" || upper === "KRW" || upper === "VND") {
    return 1
  }
  return 100
}

function parseBalance(
  raw: string | undefined,
  currency: string | undefined
): number | null {
  if (raw == null || raw === "") return null
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed / currencyOffset(currency)
}

function normalizeAccountId(raw: string): string {
  return raw.replace(/^act_/i, "")
}

function billingUrlForAccount(accountId: string): string {
  const id = normalizeAccountId(accountId)
  return `https://business.facebook.com/billing_hub/payment_activity?asset_id=${id}`
}

function isPaymentBlocked(status: number, disableReason: number): boolean {
  if (status === ACCOUNT_STATUS.UNSETTLED) return true
  if (status === ACCOUNT_STATUS.IN_GRACE_PERIOD) return true
  if (status === ACCOUNT_STATUS.PENDING_SETTLEMENT) return true
  if (
    status === ACCOUNT_STATUS.DISABLED &&
    disableReason === DISABLE_REASON.RISK_PAYMENT
  ) {
    return true
  }
  return false
}

function buildIssue(account: MetaAdAccountPaymentFields): MetaPaymentIssue | null {
  const status = account.account_status ?? ACCOUNT_STATUS.ACTIVE
  const disableReason = account.disable_reason ?? DISABLE_REASON.NONE
  const rawId = account.account_id ?? account.id
  if (!rawId) return null

  const accountId = normalizeAccountId(rawId)
  const accountName = account.name?.trim() || `Cuenta ${accountId}`
  const currency = toCurrencyCode(account.currency)
  const balance = parseBalance(account.balance, account.currency)

  if (status === ACCOUNT_STATUS.ACTIVE) return null

  if (isPaymentBlocked(status, disableReason)) {
    return {
      accountId,
      accountName,
      kind: "payment_error",
      statusLabel: "ERROR DE PAGO",
      message:
        "Tu método de pago falló o tienes un saldo pendiente. Meta bloqueó la entrega de ads.",
      actionHint:
        "Qué hacer: Ir al Administrador Comercial → Facturación → saldar la deuda o actualizar el método de pago.",
      balance,
      currency,
      billingUrl: billingUrlForAccount(accountId),
      fingerprint: `payment:${accountId}:${status}:${balance ?? 0}`,
    }
  }

  if (status === ACCOUNT_STATUS.DISABLED) {
    return {
      accountId,
      accountName,
      kind: "account_blocked",
      statusLabel: "CUENTA BLOQUEADA",
      message:
        "Meta desactivó esta cuenta publicitaria. Los ads no se están entregando.",
      actionHint:
        "Qué hacer: Revisá el estado de la cuenta en el Administrador de Anuncios o contactá soporte de Meta.",
      balance,
      currency,
      billingUrl: billingUrlForAccount(accountId),
      fingerprint: `blocked:${accountId}:${status}:${disableReason}`,
    }
  }

  return null
}

async function fetchAdAccountPaymentFields(
  accountId: string
): Promise<MetaAdAccountPaymentFields> {
  const id = normalizeAccountId(accountId)
  const url = buildMetaGraphUrl(`act_${id}`, {
    fields: "id,account_id,name,account_status,disable_reason,balance,currency",
  })

  let lastError: unknown

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
      })

      const body = (await response.json().catch(() => null)) as
        | (MetaAdAccountPaymentFields & {
            error?: { message?: string; code?: number; error_subcode?: number }
          })
        | null

      if (response.ok && body && !body.error) {
        return body
      }

      if (isMetaRateLimitStatus(response.status, body) && attempt < MAX_RETRIES) {
        await sleep(BASE_DELAY_MS * (attempt + 1))
        continue
      }

      throw new Error(metaGraphErrorMessage(response.status, body))
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : ""
      if (isMetaRateLimitMessage(message) && attempt < MAX_RETRIES) {
        await sleep(BASE_DELAY_MS * (attempt + 1))
        continue
      }
      throw error
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("No se pudo consultar el estado de pago de Meta")
}

async function fetchMetaPaymentAlerts(): Promise<MetaPaymentAlertsResult> {
  assertMetaEnvConfigured()
  const accountId = process.env.META_AD_ACCOUNT_ID!.trim()
  const account = await fetchAdAccountPaymentFields(accountId)
  const issue = buildIssue(account)
  return { issues: issue ? [issue] : [] }
}

/** Alertas de pago/bloqueo de la cuenta Meta configurada en el entorno. */
export async function getMetaPaymentAlerts(): Promise<MetaPaymentAlertsResult> {
  if (!isMetaEnvConfigured()) {
    return { issues: [] }
  }

  const accountId = process.env.META_AD_ACCOUNT_ID!.trim()
  const cacheKey = `meta-payment-alerts:v1:${accountId}`

  try {
    return await withMetaCache(cacheKey, PAYMENT_STATUS_TTL_MS, () =>
      fetchMetaPaymentAlerts()
    )
  } catch (error) {
    console.error("[meta-payment-alerts]", error)
    return { issues: [] }
  }
}
