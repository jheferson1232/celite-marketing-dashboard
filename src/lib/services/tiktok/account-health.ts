import "server-only"

import type { AxiosInstance } from "axios"
import type { CurrencyCode } from "@/lib/format"
import { DASHBOARD_TIMEZONE, getTodayDateRange } from "@/lib/date"
import prisma from "@/lib/prisma"
import { assertTikTokAdAccountPrisma } from "./tiktok-credentials.server"
import { createTikTokClient } from "./tiktok-client"
import {
  ACCOUNT_METRICS,
  aggregateReportMetrics,
  getMetricNumber,
} from "./report"
import type { TikTokApiResponse, TikTokCampaign, TikTokListResponse, TikTokReportData } from "./types"

export type TikTokBillingMode = "prepaid" | "postpaid" | "unknown"

export type TikTokAdAccountHealth = {
  accountId: string
  activeCampaigns: number
  totalCampaigns: number
  campaignCountsAvailable: boolean
  todaySpend: number
  monthSpend: number
  balance: number | null
  unpaidAmount: number | null
  paymentStatus: "ok" | "no_balance" | "unpaid" | "unknown"
  paymentNote: string | null
  billingMode: TikTokBillingMode
  creditLimit: number | null
  creditAvailable: number | null
  creditConsumed: number | null
  currency: CurrencyCode
}

type AdvertiserBalanceInfo = {
  balance?: number
  owner_bc_id?: string
  currency?: string
}

function toCurrencyCode(value: string | null | undefined): CurrencyCode {
  const upper = value?.trim().toUpperCase()
  if (upper === "COP") return "COP"
  if (upper === "MXN" || upper === "MX") return "MX"
  return "PEN"
}

function parseApiError(error: unknown): string {
  if (error instanceof Error) return error.message
  return "Error desconocido"
}

function toUserFriendlyFinanceNote(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes("qps limit")) {
    return "TikTok limitó temporalmente la consulta financiera. Reintentá en 1-2 minutos."
  }
  if (lower.includes("invoice_type")) {
    return "TikTok rechazó temporalmente la consulta de facturación. Reintentá más tarde."
  }
  return message
}

function shouldHidePaymentNote(note: string | null | undefined): boolean {
  if (!note) return false
  const lower = note.toLowerCase()
  return (
    lower.includes("sin permiso financiero en tiktok") ||
    lower.includes("qps limit") ||
    lower.includes("invoice_type")
  )
}

function sanitizePaymentNote(note: string | null | undefined): string | null {
  if (!note || shouldHidePaymentNote(note)) return null
  return note
}

function isFinancePermissionError(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes("finance permission") || lower.includes("finance role")
}

async function fetchAdvertiserBalanceInfo(
  client: AxiosInstance,
  advertiserId: string
): Promise<AdvertiserBalanceInfo | null> {
  const { data } = await client.get<{
    data: { list?: AdvertiserBalanceInfo[] }
  }>("/advertiser/info/", {
    params: {
      advertiser_ids: JSON.stringify([advertiserId]),
      fields: JSON.stringify([
        "advertiser_id",
        "balance",
        "owner_bc_id",
        "currency",
      ]),
    },
  })

  return data.data.list?.[0] ?? null
}

async function countCampaigns(
  client: AxiosInstance,
  advertiserId: string
): Promise<{ activeCampaigns: number; totalCampaigns: number }> {
  let activeCampaigns = 0
  let totalCampaigns = 0
  let reportedTotal: number | null = null
  let page = 1
  let totalPage = 1

  while (page <= totalPage) {
    const { data } = await client.get<
      TikTokApiResponse<TikTokListResponse<TikTokCampaign>>
    >("/campaign/get/", {
      params: {
        advertiser_id: advertiserId,
        page,
        page_size: 500,
      },
    })

    const list = data.data.list ?? []
    totalCampaigns += list.length
    activeCampaigns += list.filter((campaign) =>
      campaign.operation_status === "ENABLE" || campaign.operation_status === "ACTIVE"
    ).length
    if (reportedTotal == null) {
      const rawTotal = data.data.page_info?.total_number
      reportedTotal =
        typeof rawTotal === "number" && Number.isFinite(rawTotal) && rawTotal >= 0
          ? rawTotal
          : null
    }
    totalPage = data.data.page_info?.total_page ?? 1
    page += 1
  }

  const resolvedTotal =
    reportedTotal != null && reportedTotal > totalCampaigns
      ? reportedTotal
      : totalCampaigns

  return { activeCampaigns, totalCampaigns: resolvedTotal }
}

function getMonthToDateRange(timezone: string | null | undefined): {
  from: string
  to: string
} {
  const tz = timezone?.trim() || DASHBOARD_TIMEZONE
  const to = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date())
  return { from: `${to.slice(0, 7)}-01`, to }
}

async function fetchSpendForRange(
  client: AxiosInstance,
  advertiserId: string,
  range: { from: string; to: string }
): Promise<number> {
  const rows: TikTokApiResponse<TikTokReportData>["data"]["list"] = []
  let page = 1
  let totalPage = 1

  while (page <= totalPage) {
    const { data } = await client.get<TikTokApiResponse<TikTokReportData>>(
      "/report/integrated/get/",
      {
        params: {
          advertiser_id: advertiserId,
          service_type: "AUCTION",
          report_type: "BASIC",
          data_level: "AUCTION_ADVERTISER",
          dimensions: JSON.stringify(["stat_time_day"]),
          metrics: JSON.stringify([...ACCOUNT_METRICS]),
          start_date: range.from,
          end_date: range.to,
          page,
          page_size: 500,
        },
      }
    )

    rows.push(...(data.data.list ?? []))
    totalPage = data.data.page_info?.total_page ?? 1
    page += 1
  }

  return getMetricNumber(aggregateReportMetrics(rows), "spend")
}

async function fetchTodaySpend(
  client: AxiosInstance,
  advertiserId: string
): Promise<number> {
  return fetchSpendForRange(client, advertiserId, getTodayDateRange())
}

/** TikTok solo acepta `RECON` en /bc/invoice/unpaid/get/ (no AUTO_PAY). */
const UNPAID_INVOICE_TYPE = "RECON" as const

function pickNumericField(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function parseUnpaidAmountFromPayload(payload: Record<string, unknown>): number | null {
  const direct =
    pickNumericField(payload.total_unpaid_amount) ??
    pickNumericField(payload.unpaid_amount) ??
    pickNumericField(payload.amount) ??
    pickNumericField(payload.total_amount)

  if (direct != null) return direct

  const list = payload.list
  if (!Array.isArray(list)) return null

  let total = 0
  let found = false
  for (const item of list) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    const rowAmount =
      pickNumericField(row.unpaid_amount) ??
      pickNumericField(row.amount) ??
      pickNumericField(row.total_unpaid_amount)
    if (rowAmount != null) {
      total += rowAmount
      found = true
    }
  }

  return found ? total : null
}

async function fetchUnpaidAmount(
  client: AxiosInstance,
  bcId: string
): Promise<{ amount: number | null; note: string | null; verified: boolean }> {
  try {
    const { data } = await client.get<{
      code: number
      message?: string
      data?: Record<string, unknown>
    }>("/bc/invoice/unpaid/get/", {
      params: {
        bc_id: bcId,
        invoice_type: UNPAID_INVOICE_TYPE,
      },
    })

    if (data.code !== 0) {
      const message = data.message ?? "No se pudo consultar facturas pendientes"
      if (isFinancePermissionError(message)) {
        return { amount: null, note: "Sin permiso financiero en TikTok", verified: false }
      }
      return { amount: null, note: toUserFriendlyFinanceNote(message), verified: false }
    }

    const parsed = parseUnpaidAmountFromPayload(data.data ?? {})
    return { amount: parsed ?? 0, note: null, verified: true }
  } catch (error) {
    const message = parseApiError(error)
    if (isFinancePermissionError(message)) {
      return { amount: null, note: "Sin permiso financiero en TikTok", verified: false }
    }
    return { amount: null, note: toUserFriendlyFinanceNote(message), verified: false }
  }
}

type AdvertiserBalanceRow = Record<string, unknown> & {
  advertiser_id?: string | number
}

type AdvertiserBcBalance = {
  balance: number | null
  billingType: string | null
  creditLimit: number | null
  creditAvailable: number | null
  creditConsumed: number | null
  cashBalance: number | null
  note: string | null
}

function parseAdvertiserBcBalanceRow(row: AdvertiserBalanceRow): AdvertiserBcBalance {
  const billingType =
    typeof row.billing_type === "string"
      ? row.billing_type
      : typeof row.payment_type === "string"
        ? row.payment_type
        : null

  const cashBalance =
    pickNumericField(row.cash_balance) ??
    pickNumericField(row.valid_cash_balance)

  const creditLimit =
    pickNumericField(row.budget) ??
    pickNumericField(row.credit_limit) ??
    pickNumericField(row.credit_balance)

  let creditConsumed =
    pickNumericField(row.budget_cost) ??
    pickNumericField(row.cost) ??
    pickNumericField(row.spend) ??
    pickNumericField(row.consumed_credit)

  let creditAvailable =
    pickNumericField(row.budget_remaining) ??
    pickNumericField(row.remaining_credit) ??
    pickNumericField(row.valid_account_balance) ??
    pickNumericField(row.account_balance) ??
    pickNumericField(row.balance)

  if (
    creditAvailable == null &&
    creditLimit != null &&
    creditConsumed != null
  ) {
    creditAvailable = Math.max(0, creditLimit - creditConsumed)
  }

  const balance =
    pickNumericField(row.valid_account_balance) ??
    pickNumericField(row.account_balance) ??
    pickNumericField(row.balance) ??
    cashBalance ??
    creditAvailable

  return {
    balance,
    billingType,
    creditLimit,
    creditAvailable,
    creditConsumed,
    cashBalance,
    note: null,
  }
}

function inferBillingMode(input: {
  billingType: string | null
  creditLimit: number | null
  creditConsumed: number | null
  cashBalance: number | null
  balance: number | null
  monthSpend: number
}): TikTokBillingMode {
  if (input.billingType) {
    const upper = input.billingType.toUpperCase()
    if (
      upper.includes("CREDIT") ||
      upper.includes("POST") ||
      upper.includes("INVOICE") ||
      upper.includes("MONTHLY") ||
      upper.includes("AUTOPAY") ||
      upper.includes("PAY_LATER")
    ) {
      return "postpaid"
    }
    if (
      upper.includes("PREPAY") ||
      upper.includes("PRE_PAID") ||
      upper.includes("CASH")
    ) {
      return "prepaid"
    }
  }

  if (input.creditLimit != null && input.creditLimit > 0) return "postpaid"
  if (
    (input.creditConsumed != null && input.creditConsumed > 0) ||
    (input.monthSpend > 0 &&
      (input.balance ?? 0) <= 0 &&
      (input.cashBalance ?? 0) <= 0)
  ) {
    return "postpaid"
  }
  if ((input.cashBalance ?? input.balance ?? 0) > 0) return "prepaid"
  return "unknown"
}

async function fetchAdvertiserBalanceFromBc(
  client: AxiosInstance,
  bcId: string,
  advertiserId: string
): Promise<AdvertiserBcBalance> {
  const empty: AdvertiserBcBalance = {
    balance: null,
    billingType: null,
    creditLimit: null,
    creditAvailable: null,
    creditConsumed: null,
    cashBalance: null,
    note: null,
  }

  try {
    let page = 1
    let totalPage = 1

    while (page <= totalPage) {
      const { data } = await client.get<{
        code: number
        message?: string
        data?: {
          list?: AdvertiserBalanceRow[]
          page_info?: { total_page?: number }
        }
      }>("/advertiser/balance/get/", {
        params: {
          bc_id: bcId,
          page,
          page_size: 50,
        },
      })

      if (data.code !== 0) {
        const message = data.message ?? "No se pudo consultar saldo del advertiser"
        if (isFinancePermissionError(message)) {
          return { ...empty, note: "Sin permiso financiero en TikTok" }
        }
        return { ...empty, note: toUserFriendlyFinanceNote(message) }
      }

      const list = data.data?.list ?? []
      const match = list.find(
        (row) => String(row.advertiser_id ?? "") === advertiserId
      )

      if (match) {
        return parseAdvertiserBcBalanceRow(match)
      }

      totalPage = data.data?.page_info?.total_page ?? 1
      page += 1
    }

    return empty
  } catch (error) {
    const message = parseApiError(error)
    if (isFinancePermissionError(message)) {
      return { ...empty, note: "Sin permiso financiero en TikTok" }
    }
    return { ...empty, note: toUserFriendlyFinanceNote(message) }
  }
}

function reconcileUnpaidWithSpend(input: {
  balance: number | null
  unpaidAmount: number | null
  paymentNote: string | null
  todaySpend: number
}): { unpaidAmount: number | null; paymentNote: string | null } {
  if (input.unpaidAmount != null && input.unpaidAmount > 0) {
    return input
  }

  const spendingWithoutBalance =
    input.balance != null && input.balance <= 0 && input.todaySpend > 0

  if (!spendingWithoutBalance) {
    return input
  }

  if (input.unpaidAmount === 0) {
    return {
      unpaidAmount: null,
      paymentNote:
        input.paymentNote ??
        "Gasto con saldo en cero; la deuda puede no aparecer hasta la facturación de TikTok",
    }
  }

  if (input.unpaidAmount == null && !input.paymentNote) {
    return {
      unpaidAmount: null,
      paymentNote:
        "Gasto con saldo en cero; no se pudo confirmar deuda en la API de TikTok",
    }
  }

  return input
}

function resolvePaymentStatus(input: {
  balance: number | null
  unpaidAmount: number | null
  todaySpend: number
  activeCampaigns: number
}): { paymentStatus: TikTokAdAccountHealth["paymentStatus"]; paymentNote: string | null } {
  if (input.unpaidAmount != null && input.unpaidAmount > 0) {
    return { paymentStatus: "unpaid", paymentNote: null }
  }

  if (input.balance != null) {
    if (input.balance <= 0) {
      return {
        paymentStatus: "no_balance",
        paymentNote:
          input.activeCampaigns > 0 && input.todaySpend > 0
            ? "Campañas activas con saldo en cero"
            : null,
      }
    }
    return { paymentStatus: "ok", paymentNote: null }
  }

  return { paymentStatus: "unknown", paymentNote: null }
}

async function fetchTikTokAdAccountHealth(input: {
  accountId: string
  advertiserId: string
  accessToken: string
  currency: string | null
  timezone: string | null
}): Promise<TikTokAdAccountHealth> {
  const client = createTikTokClient(input.accessToken)
  const currency = toCurrencyCode(input.currency)
  const monthRange = getMonthToDateRange(input.timezone)

  const [campaignCountsResult, todaySpendResult, monthSpendResult, balanceInfoResult] =
    await Promise.allSettled([
      countCampaigns(client, input.advertiserId),
      fetchTodaySpend(client, input.advertiserId),
      fetchSpendForRange(client, input.advertiserId, monthRange),
      fetchAdvertiserBalanceInfo(client, input.advertiserId),
    ])

  const campaignCounts =
    campaignCountsResult.status === "fulfilled"
      ? campaignCountsResult.value
      : { activeCampaigns: 0, totalCampaigns: 0 }
  const campaignCountsAvailable = campaignCountsResult.status === "fulfilled"
  const todaySpend =
    todaySpendResult.status === "fulfilled" ? todaySpendResult.value : 0
  const monthSpend =
    monthSpendResult.status === "fulfilled" ? monthSpendResult.value : 0
  const balanceInfo =
    balanceInfoResult.status === "fulfilled" ? balanceInfoResult.value : null

  let balance =
    typeof balanceInfo?.balance === "number" ? balanceInfo.balance : null

  let unpaidAmount: number | null = null
  let paymentNote: string | null = null
  let billingMode: TikTokBillingMode = "unknown"
  let creditLimit: number | null = null
  let creditAvailable: number | null = null
  let creditConsumed: number | null = null

  if (balanceInfo?.owner_bc_id) {
    const [unpaid, advertiserBalance] = await Promise.all([
      fetchUnpaidAmount(client, balanceInfo.owner_bc_id),
      fetchAdvertiserBalanceFromBc(
        client,
        balanceInfo.owner_bc_id,
        input.advertiserId
      ),
    ])

    unpaidAmount = unpaid.amount
    paymentNote = unpaid.note ?? advertiserBalance.note

    if (balance == null && advertiserBalance.balance != null) {
      balance = advertiserBalance.balance
    }

    creditLimit = advertiserBalance.creditLimit
    creditAvailable = advertiserBalance.creditAvailable
    creditConsumed =
      advertiserBalance.creditConsumed != null && advertiserBalance.creditConsumed > 0
        ? advertiserBalance.creditConsumed
        : null

    billingMode = inferBillingMode({
      billingType: advertiserBalance.billingType,
      creditLimit,
      creditConsumed,
      cashBalance: advertiserBalance.cashBalance,
      balance,
      monthSpend,
    })

    if (billingMode === "postpaid") {
      if (creditConsumed == null && monthSpend > 0) {
        creditConsumed = monthSpend
      }
      if (
        creditAvailable == null &&
        creditLimit != null &&
        creditConsumed != null
      ) {
        creditAvailable = Math.max(0, creditLimit - creditConsumed)
      }
    }

    if (
      unpaid.verified &&
      (unpaidAmount == null || unpaidAmount <= 0) &&
      billingMode === "postpaid" &&
      creditConsumed != null &&
      creditConsumed > 0
    ) {
      unpaidAmount = creditConsumed
      paymentNote = null
    }
  } else {
    paymentNote =
      "Sin Business Center vinculado en TikTok; no se puede consultar deuda facturada"
    billingMode = inferBillingMode({
      billingType: null,
      creditLimit: null,
      creditConsumed: null,
      cashBalance: null,
      balance,
      monthSpend,
    })
    if (billingMode === "postpaid" && monthSpend > 0) {
      creditConsumed = monthSpend
    }
  }

  const reconciled = reconcileUnpaidWithSpend({
    balance,
    unpaidAmount,
    paymentNote,
    todaySpend,
  })
  unpaidAmount = reconciled.unpaidAmount
  paymentNote = reconciled.paymentNote

  const payment = resolvePaymentStatus({
    balance,
    unpaidAmount,
    todaySpend,
    activeCampaigns: campaignCounts.activeCampaigns,
  })

  return {
    accountId: input.accountId,
    activeCampaigns: campaignCounts.activeCampaigns,
    totalCampaigns: campaignCounts.totalCampaigns,
    campaignCountsAvailable,
    todaySpend,
    monthSpend,
    balance,
    unpaidAmount,
    paymentStatus: payment.paymentStatus,
    paymentNote: sanitizePaymentNote(paymentNote ?? payment.paymentNote),
    billingMode,
    creditLimit,
    creditAvailable,
    creditConsumed,
    currency,
  }
}

export async function getTikTokAdAccountsHealth(): Promise<
  TikTokAdAccountHealth[]
> {
  assertTikTokAdAccountPrisma()

  const rows = await prisma.tikTokAdAccount.findMany({
    where: { status: "active" },
    orderBy: [
      { isDefaultForTests: "desc" },
      { isDefault: "desc" },
      { connectedAt: "desc" },
    ],
    select: {
      id: true,
      advertiserId: true,
      accessToken: true,
      currency: true,
      timezone: true,
    },
  })

  const results = await Promise.all(
    rows.map(async (row) => {
      if (!row.accessToken?.trim()) {
        return {
          accountId: row.id,
          activeCampaigns: 0,
          totalCampaigns: 0,
          campaignCountsAvailable: false,
          todaySpend: 0,
          monthSpend: 0,
          balance: null,
          unpaidAmount: null,
          paymentStatus: "unknown" as const,
          paymentNote: "Cuenta sin token de acceso",
          billingMode: "unknown" as const,
          creditLimit: null,
          creditAvailable: null,
          creditConsumed: null,
          currency: toCurrencyCode(row.currency),
        }
      }

      try {
        return await fetchTikTokAdAccountHealth({
          accountId: row.id,
          advertiserId: row.advertiserId,
          accessToken: row.accessToken,
          currency: row.currency,
          timezone: row.timezone,
        })
      } catch (error) {
        return {
          accountId: row.id,
          activeCampaigns: 0,
          totalCampaigns: 0,
          campaignCountsAvailable: false,
          todaySpend: 0,
          monthSpend: 0,
          balance: null,
          unpaidAmount: null,
          paymentStatus: "unknown" as const,
          paymentNote: sanitizePaymentNote(
            toUserFriendlyFinanceNote(parseApiError(error))
          ),
          billingMode: "unknown" as const,
          creditLimit: null,
          creditAvailable: null,
          creditConsumed: null,
          currency: toCurrencyCode(row.currency),
        }
      }
    })
  )

  return results
}
