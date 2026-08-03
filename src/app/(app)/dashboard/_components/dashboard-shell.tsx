"use client"

import type { UIMessage } from "ai"
import { type ReactNode, useEffect, useState, useTransition } from "react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { runServerAction } from "@/lib/server-action"
import { AssistantLauncher } from "./assistant-launcher"
import { DashboardAssistantPanel } from "./dashboard-assistant-panel"
import { createAssistantChatAction } from "../_actions/chat"
import { useAssistantPanel } from "../_lib/use-assistant-panel"

type ChatSummary = {
  id: string
  title: string | null
  updatedAt: Date | string
  _count: { messages: number }
}

interface DashboardShellProps {
  children: ReactNode
  chats: ChatSummary[]
  activeChatId: string
  initialMessages: UIMessage[]
}

export function DashboardShell({
  children,
  chats,
  activeChatId: serverChatId,
  initialMessages: serverMessages,
}: DashboardShellProps) {
  const pathname = usePathname()
  const [{ assistant, chat: chatFromUrl }, setPanel] = useAssistantPanel()
  const [menuOpen, setMenuOpen] = useState(false)
  const [isOpening, startOpening] = useTransition()
  const [openError, setOpenError] = useState<string | null>(null)

  const chatOpen = assistant !== false
  const activeChatId = chatFromUrl || serverChatId
  const initialMessages =
    chatFromUrl && chatFromUrl === serverChatId ? serverMessages : []

  function openAssistant() {
    setOpenError(null)
    setMenuOpen(false)
    startOpening(async () => {
      try {
        const result = await runServerAction(createAssistantChatAction())
        if (!result?.id) {
          setOpenError("No se pudo crear la conversación.")
          setPanel({ assistant: true, chat: null })
          return
        }
        setPanel({ assistant: true, chat: result.id })
      } catch (error) {
        setOpenError(
          error instanceof Error
            ? error.message
            : "No se pudo abrir el asistente. Intenta de nuevo."
        )
        setPanel({ assistant: true, chat: null })
      }
    })
  }

  function closeAssistant() {
    setOpenError(null)
    setMenuOpen(false)
    setPanel({ assistant: false, chat: null })
  }

  useEffect(() => {
    if (assistant !== false && !activeChatId && !isOpening && !openError) {
      openAssistant()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir sin chat en URL
  }, [assistant, activeChatId, isOpening, openError])

  const panelProps = {
    chats,
    activeChatId,
    initialMessages,
    returnPath: pathname,
    isLoading: isOpening || (!activeChatId && !openError),
    openError,
    onRetryOpen: openAssistant,
    onCollapse: closeAssistant,
    onClose: closeAssistant,
  }

  return (
    <div className="flex h-dvh min-h-0 w-full overflow-hidden">
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</div>

      {chatOpen ? (
        <div
          className={cn(
            "fixed right-4 bottom-4 z-40 flex w-[min(100vw-2rem,24rem)] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl",
            "h-[min(70dvh,36rem)]"
          )}
        >
          <DashboardAssistantPanel {...panelProps} />
        </div>
      ) : (
        <AssistantLauncher
          menuOpen={menuOpen}
          chatOpen={chatOpen}
          isOpening={isOpening}
          onToggleMenu={() => setMenuOpen((prev) => !prev)}
          onOpenChat={openAssistant}
          onCloseMenu={() => setMenuOpen(false)}
        />
      )}
    </div>
  )
}
