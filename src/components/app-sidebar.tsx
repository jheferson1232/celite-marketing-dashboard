"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  RiArchiveLine,
  RiBarChartGroupedLine,
  RiBrainLine,
  RiStarLine,
  RiShoppingBag2Line,
  RiMegaphoneLine,
  RiMetaLine,
  RiLinksLine,
  RiTiktokLine,
  RiRobotLine,
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
    id: "informe-ia",
    title: "Informe IA (Meta)",
    href: "/informe-ia",
    icon: RiBrainLine,
  },
  {
    id: "tiktok",
    title: "TikTok",
    href: "/tiktok",
    icon: RiTiktokLine,
  },
  {
    id: "tiktok-cuentas",
    title: "Cuentas TikTok Ads",
    href: "/tiktok/cuentas",
    icon: RiLinksLine,
  },
  {
    id: "tiktok-agente",
    title: "TikTok Agente",
    href: "/tiktok/agente",
    icon: RiRobotLine,
  },
  {
    id: "campaigns",
    title: "Campaigns",
    href: "/campaigns",
    icon: RiMegaphoneLine,
  },
  {
    id: "products",
    title: "Productos",
    href: "/products",
    icon: RiShoppingBag2Line,
  },
  {
    id: "productos-pendientes",
    title: "Productos pendientes",
    href: "/productos-pendientes",
    icon: RiStarLine,
  },
  {
    id: "baul",
    title: "Baúl",
    href: "/baul",
    icon: RiArchiveLine,
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
                        : item.id === "informe-ia"
                          ? pathname === "/informe-ia" ||
                            pathname.startsWith("/informe-ia/")
                          : item.id === "tiktok"
                            ? pathname === "/tiktok"
                            : item.id === "tiktok-cuentas"
                              ? pathname === "/tiktok/cuentas" ||
                                pathname.startsWith("/tiktok/cuentas/")
                              : item.id === "tiktok-agente"
                                ? pathname === "/tiktok/agente" ||
                                  pathname.startsWith("/tiktok/agente/")
                                : item.id === "campaigns"
                              ? pathname === "/campaigns" ||
                                pathname.startsWith("/campaigns/")
                            : item.id === "products"
                              ? pathname === "/products" ||
                                pathname.startsWith("/products/") ||
                                pathname.startsWith("/product-stats/")
                              : item.id === "productos-pendientes"
                                ? pathname === "/productos-pendientes" ||
                                  pathname.startsWith("/productos-pendientes/")
                                : item.id === "baul"
                                ? pathname === "/baul" ||
                                  pathname.startsWith("/baul/")
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
