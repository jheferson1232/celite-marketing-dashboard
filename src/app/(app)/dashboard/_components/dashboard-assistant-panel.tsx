"use client"

import type { UIMessage } from "ai"
import {
  RiAddLine,
  RiCloseLine,
  RiMenuLine,
  RiSparklingLine,
  RiSubtractLine,
} from "@remixicon/react"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { ChatUI } from "@/app/(app)/inbox/_components/chat-ui"
import type { ChatPlatform } from "@/lib/chat/kpi-response"
import { createDashboardChat } from "../_actions/chat"
import { usePathname } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"

const META_SUGGESTIONS = [
  "¿Cómo nos fue hoy?",
  "¿Qué campaña vendió más esta semana?",
  "¿Cuánto gasté entre Meta y TikTok hoy?",
]

const TIKTOK_SUGGESTIONS = [
  "¿Cómo nos fue hoy en TikTok?",
  "Apaga la campaña cbo urbano",
  "Sube 20% el presupuesto del mejor conjunto hoy",
  "Prende la campaña Hertz Art",
]

function getPlatformFromPath(path: string): ChatPlatform {
  return path.startsWith("/tiktok") ? "tiktok" : "meta"
}

type ChatSummary = {
  id: string
  title: string | null
  updatedAt: Date
  _count: { messages: number }
}

interface DashboardAssistantPanelProps {
  chats: ChatSummary[]
  activeChatId: string
  initialMessages: UIMessage[]
  returnPath: string
  isLoading?: boolean
  onCollapse: () => void
  onClose: () => void
}

export function DashboardAssistantPanel({
  chats,
  activeChatId,
  initialMessages,
  returnPath,
  isLoading = false,
  onCollapse,
  onClose,
}: DashboardAssistantPanelProps) {
  const pathname = usePathname()
  const chatBasePath = returnPath || pathname
  const platform = getPlatformFromPath(chatBasePath)
  const suggestions =
    platform === "tiktok" ? TIKTOK_SUGGESTIONS : META_SUGGESTIONS
  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-l bg-background">
      <header className="flex shrink-0 items-center gap-2 border-b px-3 py-2.5">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="shrink-0">
              <RiMenuLine className="size-4" />
              <span className="sr-only">Historial</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-0">
            <div className="border-b p-2">
              <form action={createDashboardChat}>
                <input type="hidden" name="returnPath" value={chatBasePath} />
                <Button type="submit" variant="outline" size="sm" className="w-full gap-2">
                  <RiAddLine className="size-4" />
                  Nueva conversación
                </Button>
              </form>
            </div>
            <ul className="max-h-64 overflow-y-auto">
              {chats.length === 0 ? (
                <li className="text-muted-foreground p-4 text-center text-sm">
                  Sin conversaciones
                </li>
              ) : (
                chats.map((chat) => (
                  <li key={chat.id}>
                    <Link
                      href={`${chatBasePath}?chat=${chat.id}&assistant=true`}
                      className={cn(
                        "hover:bg-muted/60 block w-full px-3 py-2.5 text-left transition-colors",
                        activeChatId === chat.id && "bg-muted"
                      )}
                    >
                      <p className="truncate text-sm font-medium">
                        {chat.title ?? "Sin título"}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {formatDistanceToNow(chat.updatedAt, {
                          addSuffix: true,
                          locale: es,
                        })}
                        {" · "}
                        {chat._count.messages} mensajes
                      </p>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </PopoverContent>
        </Popover>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full">
            <RiSparklingLine className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              Asistente de Marketing IA
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {platform === "tiktok"
                ? "TikTok (S/) y Meta ($ COP)"
                : "Meta ($ COP) y TikTok (S/)"}
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onCollapse}
          title="Minimizar"
        >
          <RiSubtractLine className="size-4" />
          <span className="sr-only">Minimizar</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          title="Cerrar"
        >
          <RiCloseLine className="size-4" />
          <span className="sr-only">Cerrar</span>
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        {isLoading || !activeChatId ? (
          <div className="flex flex-1 flex-col gap-3 p-4">
            <Skeleton className="h-16 w-3/4" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="mt-auto h-10 w-full" />
          </div>
        ) : (
          <ChatUI
            key={activeChatId}
            chatId={activeChatId}
            initialMessages={initialMessages}
            platform={platform}
            compact
            suggestions={suggestions}
          />
        )}
      </div>
    </aside>
  )
}
