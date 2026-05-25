"use client"

import { CAMPAIGN_STATUS_VALUES } from "@/lib/campaigns/status"
import type { CampaignStatus } from "@/lib/campaigns/status"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  CAMPAIGN_STATUS_BADGE_CLASS,
  CAMPAIGN_STATUS_LABELS,
} from "../_lib/status-labels"

interface CampaignGeneralSectionProps {
  name: string
  status: CampaignStatus
  disabled?: boolean
  onNameChange: (name: string) => void
  onStatusChange: (status: CampaignStatus) => void
}

export function CampaignGeneralSection({
  name,
  status,
  disabled = false,
  onNameChange,
  onStatusChange,
}: CampaignGeneralSectionProps) {
  return (
    <section className="max-w-2xl space-y-4 rounded-xl border bg-muted/10 p-4">
      <div>
        <h2 className="text-sm font-semibold">Información general</h2>
        <p className="text-xs text-muted-foreground">
          Nombre y estado de la campaña. Estos campos no dependen de la estrategia.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="campaign-name" className="text-sm font-medium">
          Nombre de la campaña
        </label>
        <Input
          id="campaign-name"
          value={name}
          disabled={disabled}
          onChange={(event) => onNameChange(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="campaign-status" className="text-sm font-medium">
          Status
        </label>
        <select
          id="campaign-status"
          className={cn(
            "border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm shadow-xs",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
          value={status}
          disabled={disabled}
          onChange={(event) => onStatusChange(event.target.value as CampaignStatus)}
        >
          {CAMPAIGN_STATUS_VALUES.map((value) => (
            <option key={value} value={value}>
              {CAMPAIGN_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Estado actual:{" "}
          <span className={cn("font-medium", CAMPAIGN_STATUS_BADGE_CLASS[status])}>
            {CAMPAIGN_STATUS_LABELS[status]}
          </span>
        </p>
      </div>
    </section>
  )
}
