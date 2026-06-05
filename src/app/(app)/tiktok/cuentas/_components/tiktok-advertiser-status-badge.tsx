import { Badge } from "@/components/ui/badge"
import {
  tikTokAdvertiserStatusBadgeClass,
  type TikTokAdvertiserStatusKind,
} from "@/lib/services/tiktok/tiktok-advertiser-status.shared"

type Props = {
  label: string
  kind: TikTokAdvertiserStatusKind
  raw: string | null
}

export function TikTokAdvertiserStatusBadge({ label, kind, raw }: Props) {
  return (
    <Badge
      variant="outline"
      className={tikTokAdvertiserStatusBadgeClass(kind)}
      title={raw && raw !== label ? `TikTok: ${raw}` : undefined}
    >
      {label}
    </Badge>
  )
}
