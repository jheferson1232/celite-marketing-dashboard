"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { RiAddLine } from "@remixicon/react"

export function ConnectTikTokAccountButton() {
  return (
    <Button asChild>
      <Link href="/api/tiktok/oauth/start">
        <RiAddLine />
        Conectar cuenta TikTok Ads
      </Link>
    </Button>
  )
}
