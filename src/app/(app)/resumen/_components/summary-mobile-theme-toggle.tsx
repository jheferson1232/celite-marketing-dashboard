"use client"

import { useEffect, useState } from "react"
import { RiMoonLine, RiSunLine } from "@remixicon/react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Solo móvil (< md): alterna modo claro / oscuro en la pestaña Resumen. */
export function SummaryMobileThemeToggle({
  className,
}: {
  className?: string
}) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = resolvedTheme === "dark"

  return (
    <Button
      type="button"
      variant="outline"
      className={cn(
        "h-9 shrink-0 gap-2 px-3 md:hidden",
        className
      )}
      disabled={!mounted}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Activar modo claro" : "Activar modo oscuro"}
    >
      {mounted ? (
        isDark ? (
          <>
            <RiSunLine className="size-4" aria-hidden />
            <span className="text-sm">Claro</span>
          </>
        ) : (
          <>
            <RiMoonLine className="size-4" aria-hidden />
            <span className="text-sm">Oscuro</span>
          </>
        )
      ) : (
        <span className="text-sm text-muted-foreground">Tema</span>
      )}
    </Button>
  )
}
