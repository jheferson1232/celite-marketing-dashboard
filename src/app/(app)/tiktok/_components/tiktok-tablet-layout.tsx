"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { useSidebar } from "@/components/ui/sidebar"

const TABLET_MAX_WIDTH_PX = 1279
const SESSION_INIT_KEY = "tiktok_sidebar_tablet_init"

function isTabletViewport(): boolean {
  return window.matchMedia(`(max-width: ${TABLET_MAX_WIDTH_PX}px)`).matches
}

/**
 * En tablet, colapsa la barra lateral al entrar a TikTok para ganar espacio horizontal.
 * El usuario puede expandirla con el botón de menú o la barra lateral (rail).
 */
export function TikTokTabletLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { setOpen, isMobile } = useSidebar()

  React.useEffect(() => {
    if (!pathname.startsWith("/tiktok")) return
    if (isMobile) return
    if (sessionStorage.getItem(SESSION_INIT_KEY)) return
    if (!isTabletViewport()) return

    sessionStorage.setItem(SESSION_INIT_KEY, "1")
    setOpen(false)
  }, [pathname, isMobile, setOpen])

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col [&_[data-slot=scroll-area-viewport]]:overflow-x-auto">
      {children}
    </div>
  )
}
