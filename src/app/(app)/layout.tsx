import { Suspense } from "react"
import { AppSidebar, AppSidebarPeekHeader } from "@/components/app-sidebar"
import { MetaPaymentAlert } from "@/components/meta-payment-alert"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <Suspense fallback={null}>
        <AppSidebar />
      </Suspense>
      <SidebarInset className="min-h-0 overflow-hidden">
        <AppSidebarPeekHeader />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </SidebarInset>
      <MetaPaymentAlert />
    </SidebarProvider>
  )
}
