import type { AudienceSegment } from "@/lib/services/meta/audience-breakdowns"
import { audienceBarColor } from "@/lib/services/meta/audience-breakdowns"
import {
  formatAudienceCpa,
  formatAudiencePurchases,
  formatAudienceSpend,
} from "@/lib/services/meta/audience-breakdowns"

function segmentMetaLine(
  segment: AudienceSegment,
  cpaAvailable: boolean
): string {
  const parts = [`${segment.percent}%`]

  if (segment.purchases > 0) {
    parts.push(`${formatAudiencePurchases(segment.purchases)} ventas`)
  }

  if (cpaAvailable && segment.cpa > 0) {
    parts.push(`CPA ${formatAudienceCpa(segment.cpa)}`)
  } else if (segment.spend > 0) {
    parts.push(formatAudienceSpend(segment.spend))
  }

  return parts.join(" · ")
}

export function AudienceBarsView({
  segments,
  cpaAvailable,
}: {
  segments: AudienceSegment[]
  cpaAvailable: boolean
}) {
  if (segments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Sin datos en este periodo.</p>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {segments.map((segment, index) => (
        <li key={segment.key}>
          <div className="mb-1 flex items-center justify-between gap-2 text-sm">
            <span className="truncate font-medium">{segment.label}</span>
            <span className="shrink-0 text-muted-foreground tabular-nums">
              {segmentMetaLine(segment, cpaAvailable)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${audienceBarColor(index)}`}
              style={{ width: `${Math.max(segment.percent, 2)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
