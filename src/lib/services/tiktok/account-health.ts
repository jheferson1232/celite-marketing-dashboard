import "server-only"

import type { AxiosInstance } from "axios"
import type { CurrencyCode } from "@/lib/format"
import { getTodayDateRange } from "@/lib/date"
import prisma from "@/lib/prisma"
import { assertTikTokAdAccountPrisma } from "./tiktok-credentials.server"
import { createTikTokClient } from "./tiktok-client"
import {
  ACCOUNT_METRICS,
  aggregateReportMetrics,
  getMetricNumber,
} from "./report"
import type { TikTokApiResponse, TikTokCampaign, TikTokListResponse, TikTokReportData } from "./types"

export type TikTokAdAccountHealth = {
  accountId: string
  activeCampaigns: number
  totalCampaigns: number
  todaySpend: number
  balance: number | null
  unpaidAmount: number | null
  paymentStatus: "ok" | "no_balance" | "unpaid" | "unknown"
  paymentNote: string | null
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
    activeCampaigns += list.filter(
      (campaign) => campaign.operation_status === "ENABLE"
    ).length
    totalPage = data.data.page_info?.total_page ?? 1
    page += 1
  }

  return { activeCampaigns, totalCampaigns }
}

async function fetchTodaySpend(
  client: AxiosInstance,
  advertiserId: string
): Promise<number> {
  const { from, to } = getTodayDateRange()
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
          start_date: from,
          end_date: to,
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

async function fetchUnpaidAmount(
  client: AxiosInstance,
  bcId: string
): Promise<{ amount: number | null; note: string | null }> {
  try {
    const { data } = await client.get<{
      code: number
      message?: string
      data?: Record<string, unknown>
    }>("/bc/invoice/unpaid/get/", {
      params: {
        bc_id: bcId,
        invoice_type: "RECON",
      },
    })

    if (data.code !== 0) {
      const message = data.message ?? "No se pudo consultar facturas pendientes"
      if (isFinancePermissionError(message)) {
        return { amount: null, note: "Sin permiso financiero en TikTok" }
      }
      return { amount: null, note: message }
    }

    const payload = data.data ?? {}
    const raw =
      payload.total_unpaid_amount ??
      payload.unpaid_amount ??
      payload.amount ??
      payload.total_amount

    const amount =
      typeof raw === "number"
        ? raw
        : typeof raw === "string"
          ? parseFloat(raw)
          : null

    if (amount == null || Number.isNaN(amount)) {
      return { amount: 0, note: null }
    }

    return { amount, note: null }
  } catch (error) {
    const message = parseApiError(error)
    if (isFinancePermissionError(message)) {
      return { amount: null, note: "Sin permiso financiero en TikTok" }
    }
    return { amount: null, note: message }
  }
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
}): Promise<TikTokAdAccountHealth> {
  const client = createTikTokClient(input.accessToken)
  const currency = toCurrencyCode(input.currency)

  const [campaignCounts, todaySpend, balanceInfo] = await Promise.all([
    countCampaigns(client, input.advertiserId),
    fetchTodaySpend(client, input.advertiserId),
    fetchAdvertiserBalanceInfo(client, input.advertiserId),
  ])

  const balance =
    typeof balanceInfo?.balance === "number" ? balanceInfo.balance : null

  let unpaidAmount: number | null = null
  let paymentNote: string | null = null

  if (balanceInfo?.owner_bc_id) {
    const unpaid = await fetchUnpaidAmount(client, balanceInfo.owner_bc_id)
    unpaidAmount = unpaid.amount
    paymentNote = unpaid.note
  }

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
    todaySpend,
    balance,
    unpaidAmount,
    paymentStatus: payment.paymentStatus,
    paymentNote: paymentNote ?? payment.paymentNote,
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
    },
  })

  const results = await Promise.all(
    rows.map(async (row) => {
      if (!row.accessToken?.trim()) {
        return {
          accountId: row.id,
          activeCampaigns: 0,
          totalCampaigns: 0,
          todaySpend: 0,
          balance: null,
          unpaidAmount: null,
          paymentStatus: "unknown" as const,
          paymentNote: "Cuenta sin token de acceso",
          currency: toCurrencyCode(row.currency),
        }
      }

      try {
        return await fetchTikTokAdAccountHealth({
          accountId: row.id,
          advertiserId: row.advertiserId,
          accessToken: row.accessToken,
          currency: row.currency,
        })
      } catch (error) {
        return {
          accountId: row.id,
          activeCampaigns: 0,
          totalCampaigns: 0,
          todaySpend: 0,
          balance: null,
          unpaidAmount: null,
          paymentStatus: "unknown" as const,
          paymentNote: parseApiError(error),
          currency: toCurrencyCode(row.currency),
        }
      }
    })
  )

  return results
}
