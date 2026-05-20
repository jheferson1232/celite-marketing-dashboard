"use client"

import type { ReactNode } from "react"

import { ScrollArea } from "@/components/ui/scroll-area"

type AppScrollAreaProps = {
  children: ReactNode
  className?: string
}

export function AppScrollArea({ children, className }: AppScrollAreaProps) {
  return (
    <ScrollArea className={className ?? "h-dvh w-full"} type="scroll">
      {children}
    </ScrollArea>
  )
}
