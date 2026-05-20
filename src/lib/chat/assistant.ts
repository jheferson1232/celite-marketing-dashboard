import { openai } from "@ai-sdk/openai"
import {
  convertToModelMessages,
  generateId,
  generateText,
  stepCountIs,
  type UIMessage,
} from "ai"
import type { ChatPlatform } from "@/lib/chat/kpi-response"
import {
  buildChatSystemPrompt,
  type ChatChannel,
} from "@/lib/chat/system-prompt"
import { chatTools } from "@/lib/chat/tools"
import { loadChat, saveChat } from "@/lib/chat/chat-store"
import { getDashboardToday, getDashboardYesterday } from "@/lib/date"

export function createUserMessage(text: string): UIMessage {
  return {
    id: generateId(),
    role: "user",
    parts: [{ type: "text", text }],
  }
}

export function createAssistantMessage(text: string): UIMessage {
  return {
    id: generateId(),
    role: "assistant",
    parts: [{ type: "text", text }],
  }
}

export async function askAssistant({
  userText,
  chatId,
  platform,
  channel = "web",
}: {
  userText: string
  chatId: string
  platform: ChatPlatform
  channel?: ChatChannel
}): Promise<string> {
  const today = getDashboardToday()
  const yesterday = getDashboardYesterday()
  const previousMessages = await loadChat(chatId)
  const userMessage = createUserMessage(userText)
  const messages = [...previousMessages, userMessage]

  const result = await generateText({
    model: openai("gpt-4o"),
    system: buildChatSystemPrompt(today, yesterday, platform, channel),
    messages: await convertToModelMessages(messages),
    tools: chatTools,
    stopWhen: stepCountIs(10),
  })

  const reply = result.text.trim() || "No pude generar una respuesta."
  const assistantMessage = createAssistantMessage(reply)
  await saveChat(chatId, [...messages, assistantMessage])

  return reply
}
