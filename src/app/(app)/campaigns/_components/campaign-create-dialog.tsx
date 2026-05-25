import Link from "next/link"
import { RiAddLine } from "@remixicon/react"
import { Button } from "@/components/ui/button"

interface CampaignCreateButtonProps {
  className?: string
}

export function CampaignCreateButton({ className }: CampaignCreateButtonProps) {
  return (
    <Button type="button" className={className} asChild>
      <Link href="/campaigns/new">
        <RiAddLine className="size-4" />
        Nueva campaña
      </Link>
    </Button>
  )
}
