"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import type { TikTokAdAccountSummary } from "@/lib/services/tiktok/ad-accounts"

type Props = {
  accounts: TikTokAdAccountSummary[]
  value: string | null
  onChange: (accountId: string) => void
  disabled?: boolean
  className?: string
  compact?: boolean
}

export function TikTokAccountSelect({
  accounts,
  value,
  onChange,
  disabled = false,
  className,
  compact = false,
}: Props) {
  if (accounts.length === 0) {
    if (compact) return null
    return (
      <p className={cn("text-muted-foreground text-sm", className)}>
        Sin cuentas conectadas.{" "}
        <Link
          href="/tiktok/cuentas"
          className="text-primary underline-offset-4 hover:underline"
        >
          Conectar
        </Link>
      </p>
    )
  }

  return (
    <select
      id="tiktok-dashboard-account"
      aria-label="Cuenta TikTok Ads"
      title="Cuenta TikTok Ads"
      className={cn(
        "border-input bg-background rounded-md border shadow-xs",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        compact
          ? "h-8 max-w-[11rem] truncate px-2 text-xs sm:max-w-[13rem]"
          : "h-9 w-full min-w-0 px-3 text-sm",
        className
      )}
      value={value ?? ""}
      disabled={disabled || !value}
      onChange={(event) => {
        const nextId = event.target.value
        if (nextId) onChange(nextId)
      }}
    >
      {accounts.map((account) => (
        <option key={account.id} value={account.id}>
          {account.name}
        </option>
      ))}
    </select>
  )
}
