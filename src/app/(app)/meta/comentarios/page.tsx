import { Suspense } from "react"
import { AppPageScrollShell } from "@/components/app-page-scroll-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { MetaComentariosContent } from "./_components/meta-comentarios-content"

export const maxDuration = 300

export const metadata = {
  title: "Comentarios IA · Meta | Marketing",
  description:
    "Agente de comentarios Facebook: Claude clasifica spam, responde preguntas y deja pasar positivos",
}

export default function MetaComentariosPage() {
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
        <MetaComentariosContent />
      </Suspense>
    </AppPageScrollShell>
  )
}
