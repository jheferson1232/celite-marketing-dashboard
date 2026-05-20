"use client"

import type { UIMessage } from "ai"
import { type ReactNode, useEffect, useState, useTransition } from "react"
import { usePathname } from "next/navigation"
import { RiSparklingLine } from "@remixicon/react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { runServerAction } from "@/lib/server-action"
import { DashboardAssistantPanel } from "./dashboard-assistant-panel"
import { createAssistantChatAction } from "../_actions/chat"
import { useAssistantPanel } from "../_lib/use-assistant-panel"

type ChatSummary = {
  id: string
  title: string | null
  updatedAt: Date
  _count: { messages: number }
}

interface DashboardShellProps {
  children: ReactNode
  chats: ChatSummary[]
  activeChatId: string
  initialMessages: UIMessage[]
}

function useLargeScreen() {
  const [isLarge, setIsLarge] = useState(true)

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const update = () => setIsLarge(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])

  return isLarge
}

export function DashboardShell({
  children,
  chats,
  activeChatId: serverChatId,
  initialMessages: serverMessages,
}: DashboardShellProps) {
  const pathname = usePathname()
  const [{ assistant, chat: chatFromUrl }, setPanel] = useAssistantPanel()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isOpening, startOpening] = useTransition()
  const isLargeScreen = useLargeScreen()
  const isOpen = assistant !== false && !isCollapsed

  const activeChatId = chatFromUrl || serverChatId
  const initialMessages =
    chatFromUrl && chatFromUrl === serverChatId ? serverMessages : []

  function openAssistant() {
    startOpening(async () => {
      const result = await runServerAction(createAssistantChatAction())
      if (!result?.id) return
      setIsCollapsed(false)
      setPanel({ assistant: true, chat: result.id })
    })
  }

  useEffect(() => {
    if (assistant !== false) {
      setIsCollapsed(false)
    }
  }, [assistant])

  useEffect(() => {
    if (assistant !== false && !activeChatId && !isOpening) {
      openAssistant()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir sin chat en URL
  }, [assistant, activeChatId, isOpening])

  const panelProps = {
    chats,
    activeChatId,
    initialMessages,
    returnPath: pathname,
    isLoading: isOpening || !activeChatId,
    onCollapse: () => setIsCollapsed(true),
    onClose: () => setPanel({ assistant: false, chat: null }),
  }

  return (
    <div className="flex h-dvh min-h-0 w-full overflow-hidden">
      <div
        className={cn(
          "min-h-0 min-w-0 flex-1 overflow-y-auto",
          isOpen && isLargeScreen && "lg:max-w-[calc(100%-min(420px,32vw))]"
        )}
      >
        {children}
      </div>

      {isOpen && isLargeScreen ? (
        <div className="hidden h-full w-[min(420px,32vw)] shrink-0 lg:flex">
          <DashboardAssistantPanel {...panelProps} />
        </div>
      ) : null}

      {!isLargeScreen ? (
        <Sheet
          open={isOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsCollapsed(true)
              setPanel({ assistant: false, chat: null })
            } else {
              openAssistant()
            }
          }}
        >
          <SheetContent
            side="right"
            showCloseButton={false}
            className="flex h-full w-full max-w-md flex-col gap-0 p-0 sm:max-w-md"
          >
            <DashboardAssistantPanel {...panelProps} />
          </SheetContent>
        </Sheet>
      ) : null}

      {!isOpen ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="fixed right-4 bottom-4 z-40 gap-2 shadow-md"
          onClick={openAssistant}
          disabled={isOpening}
        >
          <RiSparklingLine className="size-4" />
          Asistente IA
        </Button>
      ) : null}
    </div>
  )
}
