import { Suspense, type ReactNode } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { InformeIaContent } from "./_components/informe-ia-content"

export const maxDuration = 120

export const metadata = {
  title: "Informe IA · Meta | Marketing",
  description: "Checklist de activación Meta (desde hoy) y ventas por día",
}

function InformeIaScrollShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh min-h-0 w-full flex-col overflow-hidden">
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain">
        {children}
      </div>
    </div>
  )
}

export default function InformeIaPage() {
  return (
    <InformeIaScrollShell>
      <Suspense
        fallback={
          <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-96 w-full rounded-lg" />
          </div>
        }
      >
        <InformeIaContent />
      </Suspense>
    </InformeIaScrollShell>
  )
}
