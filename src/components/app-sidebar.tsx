"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  RiBarChartGroupedLine,
  RiMegaphoneLine,
  RiMetaLine,
  RiTiktokLine,
} from "@remixicon/react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

const navItems = [
  {
    id: "resumen",
    title: "Resumen",
    href: "/resumen",
    icon: RiBarChartGroupedLine,
  },
  {
    id: "meta",
    title: "Meta",
    href: "/dashboard",
    icon: RiMetaLine,
  },
  {
    id: "tiktok",
    title: "TikTok",
    href: "/tiktok",
    icon: RiTiktokLine,
  },
] as const

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <RiMegaphoneLine className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Celite</span>
                  <span className="text-muted-foreground truncate text-xs">
                    Marketing
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      item.id === "resumen"
                        ? pathname === "/resumen" ||
                          pathname.startsWith("/resumen/")
                        : item.id === "tiktok"
                          ? pathname === "/tiktok" ||
                            pathname.startsWith("/tiktok/")
                          : pathname === "/dashboard" ||
                            pathname.startsWith("/dashboard/")
                    }
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
