"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { CampaignObjectiveFilter } from "./types"

interface CampaignObjectiveFiltersProps {
  conversionsCount: number
  messagesCount: number
  selectedFilter: CampaignObjectiveFilter
  onFilterChange: (filter: CampaignObjectiveFilter) => void
}

export function CampaignObjectiveFilters({
  conversionsCount,
  messagesCount,
  selectedFilter,
  onFilterChange,
}: CampaignObjectiveFiltersProps) {
  const isConversions = selectedFilter === "CONVERSIONS"
  const isMessages = selectedFilter === "MESSAGES"

  return (
    <div
      className="contents"
      role="group"
      aria-label="Tipo de campaña"
    >
      <Badge
        variant="outline"
        className={cn(
          "cursor-pointer px-3 text-sm font-semibold",
          isConversions
            ? "border-violet-600 bg-violet-600 text-white hover:bg-violet-600"
            : "border-violet-500/70 text-violet-700 hover:bg-violet-500/10 dark:text-violet-300"
        )}
        onClick={() =>
          onFilterChange(isConversions ? "ALL" : "CONVERSIONS")
        }
      >
        {conversionsCount} conversiones
      </Badge>
      <Badge
        variant="outline"
        className={cn(
          "cursor-pointer px-3 text-sm font-semibold",
          isMessages
            ? "border-sky-600 bg-sky-600 text-white hover:bg-sky-600"
            : "border-sky-500/70 text-sky-700 hover:bg-sky-500/10 dark:text-sky-300"
        )}
        onClick={() => onFilterChange(isMessages ? "ALL" : "MESSAGES")}
      >
        {messagesCount} mensajes
      </Badge>
    </div>
  )
}
