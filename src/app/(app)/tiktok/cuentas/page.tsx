import { Suspense } from "react"
import { AppPageScrollShell } from "@/components/app-page-scroll-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { TikTokCuentasContent } from "./_components/tiktok-cuentas-content"

export const metadata = {
  title: "Cuentas TikTok Ads | Marketing",
  description: "Administrar cuentas conectadas de TikTok Ads",
}

export default function TikTokCuentasPage() {
  return (
    <AppPageScrollShell>
      <Suspense
        fallback={
          <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
        }
      >
        <TikTokCuentasContent />
      </Suspense>
    </AppPageScrollShell>
  )
}
