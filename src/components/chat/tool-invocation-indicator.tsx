"use client"

import { RiDatabase2Line, RiLoader4Line } from "@remixicon/react"
import { cn } from "@/lib/utils"

const TOOL_LABELS: Record<string, string> = {
  getMetaAccountKpis: "KPIs Meta (COP)",
  getTikTokAccountKpis: "KPIs TikTok (PEN)",
  getMetaCampaigns: "Campañas Meta",
  getTikTokCampaigns: "Campañas TikTok",
  getMetaCampaignAdSets: "Conjuntos Meta",
  getTikTokCampaignAdGroups: "Conjuntos TikTok",
  getAccountKpis: "KPIs Meta (COP)",
  getCampaigns: "Campañas Meta",
  getCampaignAdSets: "Conjuntos Meta",
}

interface ToolInvocationIndicatorProps {
  toolName: string
  state?: string
}

export function ToolInvocationIndicator({
  toolName,
  state,
}: ToolInvocationIndicatorProps) {
  const label = TOOL_LABELS[toolName] ?? "Datos de publicidad"
  const isComplete = state === "output-available"

  return (
    <div
      className={cn(
        "mt-2 flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs",
        isComplete
          ? "border-border/60 bg-background/50 text-muted-foreground"
          : "border-primary/20 bg-primary/5 text-foreground"
      )}
    >
      {isComplete ? (
        <RiDatabase2Line className="size-3.5 shrink-0" />
      ) : (
        <RiLoader4Line className="size-3.5 shrink-0 animate-spin" />
      )}
      <span>
        {isComplete ? `Consultado: ${label}` : `Consultando ${label}...`}
      </span>
    </div>
  )
}
