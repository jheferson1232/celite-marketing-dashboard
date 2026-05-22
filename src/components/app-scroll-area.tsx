"use client"

import type { ReactNode } from "react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

type AppScrollAreaProps = {
  children: ReactNode
  className?: string
}

export function AppScrollArea({ children, className }: AppScrollAreaProps) {
  return (
    <ScrollArea
      className={cn("h-dvh w-full overflow-hidden", className)}
    >{children}
    </ScrollArea>
  )
}
