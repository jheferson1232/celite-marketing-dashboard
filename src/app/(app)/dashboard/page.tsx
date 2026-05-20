import { Suspense } from "react"
import { DashboardContent } from "./_components/dashboard-content"
import { DashboardShell } from "./_components/dashboard-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { loadChat, loadChats } from "@/lib/chat/chat-store"

export const metadata = {
  title: "Meta | Marketing",
  description: "Métricas de Meta Ads",
}

interface DashboardPageProps {
  searchParams: Promise<{ chat?: string; assistant?: string }>
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams
  const chats = await loadChats()

  const hasValidChat =
    params.chat && chats.some((chat) => chat.id === params.chat)
  const activeChatId = hasValidChat ? params.chat! : ""
  const initialMessages = hasValidChat ? await loadChat(params.chat!) : []

  return (
    <DashboardShell
      chats={chats}
      activeChatId={activeChatId}
      initialMessages={initialMessages}
    >
      <Suspense
        fallback={
          <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
            <Skeleton className="h-8 w-64" />
            <div className="grid gap-4 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          </div>
        }
      >
        <DashboardContent />
      </Suspense>
    </DashboardShell>
  )
}
