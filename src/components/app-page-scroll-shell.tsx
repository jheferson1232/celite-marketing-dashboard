import type { ReactNode } from "react"

/** Scroll vertical en páginas de la app (html/body tienen overflow-hidden). */
export function AppPageScrollShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh min-h-0 w-full flex-col overflow-hidden">
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
        {children}
      </div>
    </div>
  )
}
