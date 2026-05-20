import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { RiAddLine, RiChat3Line } from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { createChat, loadChats } from "@/lib/chat/chat-store"

interface ChatListProps {
  chats: Awaited<ReturnType<typeof loadChats>>
  activeChatId?: string
}

export function ChatList({ chats, activeChatId }: ChatListProps) {
  return (
    <div className="flex h-full flex-col border-r">
      <div className="flex items-center justify-between border-b p-4">
        <h2 className="text-sm font-semibold">Conversaciones</h2>
        <form action={createNewChat}>
          <Button type="submit" size="icon-sm" variant="outline">
            <RiAddLine />
            <span className="sr-only">Nueva conversación</span>
          </Button>
        </form>
      </div>
      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 p-8 text-center text-sm">
            <RiChat3Line className="size-8 opacity-50" />
            <p>No hay conversaciones aún</p>
          </div>
        ) : (
          <ul className="divide-y">
            {chats.map((chat) => (
              <li key={chat.id}>
                <Link
                  href={`/inbox/${chat.id}`}
                  className={cn(
                    "hover:bg-muted/50 block px-4 py-3 transition-colors",
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
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

async function createNewChat() {
  "use server"
  const { redirect } = await import("next/navigation")
  const id = await createChat()
  redirect(`/inbox/${id}`)
}
