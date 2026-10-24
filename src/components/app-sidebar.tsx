"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  RiArchiveLine,
  RiBarChartGroupedLine,
  RiBrainLine,
  RiChat3Line,
  RiStarLine,
  RiShoppingBag2Line,
  RiMegaphoneLine,
  RiMenuLine,
  RiMetaLine,
  RiLinksLine,
  RiBookOpenLine,
  RiTiktokLine,
  RiRobotLine,
  RiCalendarScheduleLine,
} from "@remixicon/react"
import { Button } from "@/components/ui/button"
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
  SidebarTrigger,
  useSidebar,
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
    id: "meta-comentarios",
    title: "Comentarios IA (Meta)",
    href: "/meta/comentarios",
    icon: RiChat3Line,
  },
  {
    id: "meta-library",
    title: "Meta Library",
    href: "/meta/library",
    icon: RiBookOpenLine,
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
    id: "tiktok-comentarios",
    title: "Comentarios IA (TikTok)",
    href: "/tiktok/comentarios",
    icon: RiChat3Line,
  },
  {
    id: "buffer",
    title: "Buffer",
    href: "/buffer",
    icon: RiCalendarScheduleLine,
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

function isNavActive(id: string, href: string, pathname: string) {
  if (id === "tiktok") return pathname === "/tiktok"
  if (id === "products") {
    return (
      pathname === "/products" ||
      pathname.startsWith("/products/") ||
      pathname.startsWith("/product-stats/")
    )
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

function AppSidebarHeader() {
  const { toggleSidebar } = useSidebar()

  return (
    <SidebarHeader>
      <div className="flex items-center gap-1">
        <SidebarMenu className="min-w-0 flex-1">
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
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          onClick={toggleSidebar}
          aria-label="Ocultar menú"
        >
          <RiMenuLine />
        </Button>
      </div>
    </SidebarHeader>
  )
}

export function AppSidebarPeekHeader() {
  const { open, isMobile } = useSidebar()

  if (!isMobile && open) {
    return null
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
      <SidebarTrigger aria-label="Mostrar menú" />
      <span className="truncate text-sm font-semibold">Celite</span>
    </header>
  )
}

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="offcanvas">
      <AppSidebarHeader />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={isNavActive(item.id, item.href, pathname)}
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
