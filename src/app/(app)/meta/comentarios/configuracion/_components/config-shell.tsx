"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  RiArrowLeftLine,
  RiBuildingLine,
  RiChatDeleteLine,
  RiFlashlightLine,
  RiMegaphoneLine,
  RiShoppingBag3Line,
} from "@remixicon/react"
import { cn } from "@/lib/utils"

const NAV = [
  {
    href: "/meta/comentarios/configuracion/negocio",
    label: "Información del negocio",
    icon: RiBuildingLine,
  },
  {
    href: "/meta/comentarios/configuracion/negativos",
    label: "Comentarios negativos",
    icon: RiChatDeleteLine,
  },
  {
    href: "/meta/comentarios/configuracion/respuesta-publica",
    label: "Respuesta pública",
    icon: RiMegaphoneLine,
  },
  {
    href: "/meta/comentarios/configuracion/venta",
    label: "Venta conversacional",
    icon: RiShoppingBag3Line,
  },
  {
    href: "/meta/comentarios/configuracion/prueba",
    label: "Prueba del asistente",
    icon: RiFlashlightLine,
  },
] as const

export function MetaCommentsConfigShell({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/meta/comentarios"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
          >
            <RiArrowLeftLine className="size-4" />
            Volver al dashboard
          </Link>
        </div>
        <Link
          href="/meta/comentarios/productos"
          className="text-primary text-sm font-medium hover:underline"
        >
          Catálogo de productos / comentarios
        </Link>
      </div>

      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Agente de Comentarios
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Configuración de mensajes y comportamiento del agente
        </p>
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 lg:flex-row">
        <nav className="lg:w-56 shrink-0">
          <ul className="space-y-1 rounded-xl border bg-card p-2 shadow-sm">
            {NAV.map((item) => {
              const active = pathname === item.href
              const Icon = item.icon
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors",
                      active
                        ? "border-l-2 border-primary bg-primary/5 font-medium text-primary"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
