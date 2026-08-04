"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { RiAlertFill, RiExternalLinkLine } from "@remixicon/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/format"
import { getLocalStorageItem, setLocalStorageItem } from "@/lib/local-storage"
import { runServerAction } from "@/lib/server-action"
import { getMetaPaymentAlertsAction } from "@/app/(app)/_actions/meta-account-payment"
import type { MetaPaymentIssue } from "@/lib/services/meta/meta-account-payment-types"

const DISMISS_STORAGE_KEY = "meta-payment-alert-dismissed:v1"
/** Recordar más tarde: 4 horas */
const DISMISS_TTL_MS = 4 * 60 * 60 * 1000

type DismissState = {
  fingerprints: string[]
  dismissedUntil: number
}

function isDismissed(issues: MetaPaymentIssue[]): boolean {
  const stored = getLocalStorageItem<DismissState | null>(DISMISS_STORAGE_KEY, null)
  if (!stored) return false
  if (Date.now() > stored.dismissedUntil) return false

  const current = issues.map((issue) => issue.fingerprint).toSorted()
  const saved = [...stored.fingerprints].toSorted()
  if (current.length !== saved.length) return false
  return current.every((value, index) => value === saved[index])
}

function dismissIssues(issues: MetaPaymentIssue[]) {
  setLocalStorageItem<DismissState>(DISMISS_STORAGE_KEY, {
    fingerprints: issues.map((issue) => issue.fingerprint),
    dismissedUntil: Date.now() + DISMISS_TTL_MS,
  })
}

function IssueCard({ issue }: { issue: MetaPaymentIssue }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="font-medium text-foreground">{issue.accountName}</p>
        <Badge variant="destructive">{issue.statusLabel}</Badge>
      </div>
      <p className="text-sm text-foreground/90">{issue.message}</p>
      <p className="mt-2 text-sm text-muted-foreground">{issue.actionHint}</p>
      {issue.balance != null && issue.balance > 0 ? (
        <p className="mt-3 text-sm font-medium text-destructive">
          Saldo pendiente: {formatCurrency(issue.balance, issue.currency)}{" "}
          {issue.currency}
        </p>
      ) : null}
    </div>
  )
}

export function MetaPaymentAlert() {
  const [open, setOpen] = useState(false)

  const { data } = useQuery({
    queryKey: ["meta-payment-alerts"],
    queryFn: () => runServerAction(getMetaPaymentAlertsAction()),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })

  const issues = data?.issues ?? []

  useEffect(() => {
    if (issues.length === 0) {
      setOpen(false)
      return
    }
    if (isDismissed(issues)) {
      setOpen(false)
      return
    }
    setOpen(true)
  }, [issues])

  function handleRemindLater() {
    dismissIssues(issues)
    setOpen(false)
  }

  function handleOpenBilling() {
    const url = issues[0]?.billingUrl
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer")
    }
  }

  const count = issues.length
  if (count === 0) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-lg"
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <RiAlertFill className="size-5" />
            </div>
            <div className="flex flex-col gap-1">
              <DialogTitle className="text-destructive">
                {count === 1
                  ? "1 cuenta de Meta necesita tu atención"
                  : `${count} cuentas de Meta necesitan tu atención`}
              </DialogTitle>
              <DialogDescription>
                Hay bloqueos activos — tus ads no están corriendo en estas cuentas.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {issues.map((issue) => (
            <IssueCard key={issue.fingerprint} issue={issue} />
          ))}
        </div>

        <DialogFooter className="sm:flex-col sm:items-stretch">
          <Button
            variant="destructive"
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={handleOpenBilling}
          >
            Ir a Facturación de Meta
            <RiExternalLinkLine data-icon="inline-end" />
          </Button>
          <Button variant="outline" onClick={handleRemindLater}>
            Entendido, recordarme más tarde
          </Button>
        </DialogFooter>

        <p className="text-muted-foreground text-xs">
          El histórico de gasto de estas cuentas sigue apareciendo en tu panel.
        </p>
      </DialogContent>
    </Dialog>
  )
}
