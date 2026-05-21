"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { useState } from "react"
import { RiLoader4Line, RiSendPlaneLine } from "@remixicon/react"
import { ChatMessage } from "@/components/chat/chat-message"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { ChatPlatform } from "@/lib/chat/kpi-response"
import { cn } from "@/lib/utils"
import {
  NOTION_LAUNCH_SUGGESTION,
  NotionLaunchFlow,
} from "@/app/(app)/tiktok/_components/notion-launch-flow"

const META_SUGGESTIONS = [
  "¿Cómo nos fue hoy?",
  "¿Qué campaña vendió más esta semana?",
  "Muéstrame los KPIs del mes",
]

const TIKTOK_SUGGESTIONS = [
  "¿Cómo nos fue hoy en TikTok?",
  NOTION_LAUNCH_SUGGESTION,
  "Pausa la campaña cbo urbano",
  "Sube 20% el presupuesto del conjunto con más gasto hoy",
  "Enciende la campaña Hertz Art",
]

interface ChatUIProps {
  chatId: string
  initialMessages: UIMessage[]
  platform?: ChatPlatform
  compact?: boolean
  suggestions?: string[]
}

export function ChatUI({
  chatId,
  initialMessages,
  platform = "meta",
  compact = false,
  suggestions,
}: ChatUIProps) {
  const resolvedSuggestions =
    suggestions ??
    (platform === "tiktok" ? TIKTOK_SUGGESTIONS : META_SUGGESTIONS)
  const platformHint =
    platform === "tiktok"
      ? "métricas de TikTok Ads (soles peruanos)"
      : "campañas y métricas de Meta Ads (pesos colombianos)"
  const [input, setInput] = useState("")
  const [showNotionLaunch, setShowNotionLaunch] = useState(false)

  const { messages, sendMessage, status } = useChat({
    id: chatId,
    messages: initialMessages,
    experimental_throttle: 50,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest({ messages, id }) {
        return {
          body: {
            message: messages[messages.length - 1],
            id,
            platform,
          },
        }
      },
    }),
  })

  const isLoading = status === "streaming" || status === "submitted"
  const isStreaming = status === "streaming"
  const lastMessageId = messages.at(-1)?.id

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage({ text: input })
    setInput("")
  }

  function handleSuggestion(text: string) {
    if (isLoading) return
    if (text === NOTION_LAUNCH_SUGGESTION && platform === "tiktok") {
      setShowNotionLaunch(true)
      return
    }
    sendMessage({ text })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <div
            className={cn(
              "flex min-h-0 flex-col gap-3",
              compact
                ? "h-full justify-end pb-1"
                : "h-full items-center justify-center gap-6"
            )}
          >
            {!compact && (
              <div className="text-center">
                <h2 className="text-lg font-semibold">
                  Analista de Marketing IA
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Pregúntame sobre tus {platformHint}
                </p>
              </div>
            )}
            {showNotionLaunch && platform === "tiktok" ? (
              <NotionLaunchFlow
                compact={compact}
                onClose={() => setShowNotionLaunch(false)}
              />
            ) : (
              <ul
                className={cn(
                  "flex w-full flex-col gap-1.5",
                  compact &&
                    "max-h-[min(50dvh,18rem)] shrink overflow-y-auto overscroll-contain"
                )}
              >
                {resolvedSuggestions.map((suggestion) => (
                  <li key={suggestion} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => handleSuggestion(suggestion)}
                      className="hover:bg-muted/80 w-full rounded-lg border bg-muted/40 px-3 py-2.5 text-left text-sm leading-snug whitespace-normal break-words transition-colors"
                    >
                      {suggestion}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div
            className={cn(
              "mx-auto flex flex-col gap-3",
              compact ? "max-w-full" : "max-w-3xl gap-4"
            )}
          >
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                isStreaming={isStreaming}
                isLastMessage={message.id === lastMessageId}
              />
            ))}
            {isLoading && messages.at(-1)?.role === "user" && (
              <div className="flex justify-start">
                <div className="bg-muted flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
                  <RiLoader4Line className="size-4 animate-spin" />
                  Analizando...
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="shrink-0 border-t p-3">
        <div className={cn("flex gap-2", !compact && "mx-auto max-w-3xl")}>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Haz una pregunta..."
            className="min-h-[44px] resize-none text-sm"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            className="shrink-0"
          >
            <RiSendPlaneLine />
            <span className="sr-only">Enviar</span>
          </Button>
        </div>
      </form>
    </div>
  )
}
