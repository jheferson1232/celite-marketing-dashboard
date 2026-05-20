import { openai } from "@ai-sdk/openai"
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai"
import type { ChatPlatform } from "@/lib/chat/kpi-response"
import { buildChatSystemPrompt } from "@/lib/chat/system-prompt"
import { chatTools } from "@/lib/chat/tools"
import { loadChat, saveChat } from "@/lib/chat/chat-store"
import { getDashboardToday, getDashboardYesterday } from "@/lib/date"

export const maxDuration = 60

function parsePlatform(value: unknown): ChatPlatform {
  return value === "tiktok" ? "tiktok" : "meta"
}

export async function POST(req: Request) {
  const {
    message,
    id,
    platform: platformBody,
  }: {
    message: UIMessage
    id: string
    platform?: string
  } = await req.json()

  const platform = parsePlatform(platformBody)
  const today = getDashboardToday()
  const yesterday = getDashboardYesterday()
  const previousMessages = await loadChat(id)
  const messages = [...previousMessages, message]

  const result = streamText({
    model: openai("gpt-4o"),
    system: buildChatSystemPrompt(today, yesterday, platform),
    messages: await convertToModelMessages(messages),
    tools: chatTools,
    stopWhen: stepCountIs(10),
  })

  result.consumeStream()

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onFinish: async ({ messages: allMessages }) => {
      await saveChat(id, allMessages)
    },
  })
}
