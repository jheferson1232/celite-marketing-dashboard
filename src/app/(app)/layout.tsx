import { Suspense } from "react"
import { AppScrollArea } from "@/components/app-scroll-area"
import { AppSidebar } from "@/components/app-sidebar"
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
      <SidebarInset className="overflow-hidden">
        <AppScrollArea className="h-dvh w-full flex-1 overflow-hidden">
          {children}
        </AppScrollArea>
      </SidebarInset>
    </SidebarProvider>
  )
}
