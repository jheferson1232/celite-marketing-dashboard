import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { InformeIaContent } from "./_components/informe-ia-content"

export const metadata = {
  title: "Informe IA | Marketing",
  description: "Checklist de activación Meta y ventas por día",
}

export default function InformeIaPage() {
  return (
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
  )
}
