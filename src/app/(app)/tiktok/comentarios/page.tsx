import { Suspense } from "react"
import { AppPageScrollShell } from "@/components/app-page-scroll-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { TikTokComentariosContent } from "./_components/tiktok-comentarios-content"

export const maxDuration = 300

export const metadata = {
  title: "Comentarios IA · TikTok | Marketing",
  description:
    "Agente de comentarios TikTok: Claude clasifica spam, responde preguntas y deja pasar positivos",
}

export default function TikTokComentariosPage() {
  return (
    <AppPageScrollShell>
      <Suspense
        fallback={
          <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
        }
      >
        <TikTokComentariosContent />
      </Suspense>
    </AppPageScrollShell>
  )
}
