"use client"

import { ThemeToggleButton } from "@/app/(app)/dashboard/_components/theme-toggle-button"
import { cn } from "@/lib/utils"

/** Solo móvil (< md): alterna modo claro / oscuro en la pestaña Resumen. */
export function SummaryMobileThemeToggle({
  className,
}: {
  className?: string
}) {
  return (
    <ThemeToggleButton
      iconOnly={false}
      className={cn("md:hidden", className)}
    />
  )
}
