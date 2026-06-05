import { Suspense } from "react"
import { AppPageScrollShell } from "@/components/app-page-scroll-shell"
import { Skeleton } from "@/components/ui/skeleton"
import {
  describeSociaVaultCreditsPerSearch,
} from "@/lib/services/sociavault/sociavault-config"
import { ProductosPendientesContent } from "./_components/productos-pendientes-content"

export const maxDuration = 300

export const metadata = {
  title: "Productos pendientes | Marketing",
  description:
    "Productos pendientes y búsqueda de videos TikTok con SociaVault",
}

export default function ProductosPendientesPage() {
  return (
    <AppPageScrollShell>
      <Suspense
        fallback={
          <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        }
      >
        <ProductosPendientesContent
          creditsHint={describeSociaVaultCreditsPerSearch()}
        />
      </Suspense>
    </AppPageScrollShell>
  )
}
