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
    <SidebarProvider>
      <Suspense fallback={null}>
        <AppSidebar />
      </Suspense>
      <SidebarInset>
        <AppSidebarPeekHeader />
        <div className="min-h-0 flex-1">{children}</div>
      </SidebarInset>
      <MetaPaymentAlert />
    </SidebarProvider>
  )
}
