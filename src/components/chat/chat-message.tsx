"use client"

import type { UIMessage } from "ai"
import { cn } from "@/lib/utils"
import { AssistantMarkdown } from "./assistant-markdown"
import { ToolInvocationIndicator } from "./tool-invocation-indicator"

interface ChatMessageProps {
  message: UIMessage
  isStreaming: boolean
  isLastMessage: boolean
}

function getToolNameFromPartType(partType: string): string {
  return partType.replace(/^tool-/, "")
}

export function ChatMessage({
  message,
  isStreaming,
  isLastMessage,
}: ChatMessageProps) {
  const isUser = message.role === "user"
  const isAssistantAnimating =
    isStreaming && message.role === "assistant" && isLastMessage

  const textContent = message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("")

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-4 py-3",
          isUser
            ? "bg-primary text-primary-foreground text-sm"
            : "bg-muted text-foreground"
        )}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{textContent}</p>
        ) : (
          <>
            {message.parts.map((part, index) => {
              if (part.type === "text" && part.text) {
                return (
                  <AssistantMarkdown
                    key={`${message.id}-text-${index}`}
                    content={part.text}
                    isAnimating={isAssistantAnimating}
                  />
                )
              }

              if (part.type.startsWith("tool-")) {
                const toolPart = part as {
                  type: string
                  state?: string
                }
                return (
                  <ToolInvocationIndicator
                    key={`${message.id}-tool-${index}`}
                    toolName={getToolNameFromPartType(toolPart.type)}
                    state={toolPart.state}
                  />
                )
              }

              return null
            })}
          </>
        )}
      </div>
    </div>
  )
}
