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
}

export function TikTokAccountSelect({
  accounts,
  value,
  onChange,
  disabled = false,
  className,
}: Props) {
  if (accounts.length === 0) {
    return (
      <p className={cn("text-muted-foreground text-sm", className)}>
        Sin cuentas conectadas.{" "}
        <Link href="/tiktok/cuentas" className="text-primary underline-offset-4 hover:underline">
          Conectar en Cuentas TikTok Ads
        </Link>
      </p>
    )
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5 sm:min-w-[220px]", className)}>
      <label htmlFor="tiktok-dashboard-account" className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        Cuenta TikTok Ads
      </label>
      <select
        id="tiktok-dashboard-account"
        className={cn(
          "border-input bg-background flex h-9 w-full min-w-0 rounded-md border px-3 text-sm shadow-xs",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50"
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
            {account.name} ({account.advertiserId.slice(-4)})
          </option>
        ))}
      </select>
    </div>
  )
}
