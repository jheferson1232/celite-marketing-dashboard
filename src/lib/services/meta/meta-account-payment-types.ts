import type { CurrencyCode } from "@/lib/format"

export type MetaPaymentIssueKind = "payment_error" | "account_blocked"

export type MetaPaymentIssue = {
  accountId: string
  accountName: string
  kind: MetaPaymentIssueKind
  statusLabel: string
  message: string
  actionHint: string
  balance: number | null
  currency: CurrencyCode
  billingUrl: string
  fingerprint: string
}

export type MetaPaymentAlertsResult = {
  issues: MetaPaymentIssue[]
}
