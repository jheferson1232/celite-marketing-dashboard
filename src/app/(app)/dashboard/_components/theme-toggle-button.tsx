"use client"

import { useEffect, useState } from "react"
import { RiMoonLine, RiSunLine } from "@remixicon/react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ThemeToggleButtonProps {
  className?: string
  /** Solo icono (compacto); si false, muestra texto «Claro» / «Oscuro». */
  iconOnly?: boolean
}

export function ThemeToggleButton({
  className,
  iconOnly = true,
}: ThemeToggleButtonProps) {
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
      size={iconOnly ? "icon-sm" : "default"}
      className={cn(
        iconOnly ? "size-9 shrink-0" : "h-9 shrink-0 gap-2 px-3",
        className
      )}
      disabled={!mounted}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "Modo claro" : "Modo oscuro"}
      aria-label={isDark ? "Activar modo claro" : "Activar modo oscuro"}
    >
      {mounted ? (
        isDark ? (
          <RiSunLine className="size-4" aria-hidden />
        ) : (
          <RiMoonLine className="size-4" aria-hidden />
        )
      ) : (
        <span className="size-4 rounded-full bg-muted" aria-hidden />
      )}
      {!iconOnly && mounted ? (
        <span className="text-sm">{isDark ? "Claro" : "Oscuro"}</span>
      ) : null}
    </Button>
  )
}
