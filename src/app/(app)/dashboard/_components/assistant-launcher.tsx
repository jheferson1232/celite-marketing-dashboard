"use client"

import { RiArrowRightSLine, RiCloseLine, RiSparklingLine } from "@remixicon/react"
import { cn } from "@/lib/utils"

interface AssistantLauncherProps {
  menuOpen: boolean
  chatOpen: boolean
  isOpening: boolean
  onToggleMenu: () => void
  onOpenChat: () => void
  onCloseMenu: () => void
}

export function AssistantLauncher({
  menuOpen,
  chatOpen,
  isOpening,
  onToggleMenu,
  onOpenChat,
  onCloseMenu,
}: AssistantLauncherProps) {
  if (chatOpen) return null

  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-3">
      {menuOpen ? (
        <div
          role="dialog"
          aria-label="Ayuda"
          className="w-[min(100vw-2rem,22rem)] overflow-hidden rounded-2xl border bg-[#f4f2ee] shadow-xl dark:bg-card"
        >
          <div className="flex items-start gap-3 border-b border-black/5 bg-muted/60 px-4 py-3.5 dark:border-border">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
              <RiSparklingLine className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                ¿Cómo te ayudamos?
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Elige cómo prefieres hablar con nosotros
              </p>
            </div>
            <button
              type="button"
              onClick={onCloseMenu}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Cerrar"
            >
              <RiCloseLine className="size-4" />
            </button>
          </div>

          <div className="flex flex-col gap-2.5 p-3">
            <button
              type="button"
              onClick={onOpenChat}
              disabled={isOpening}
              className="flex w-full items-center gap-3 rounded-xl border border-transparent bg-background p-3 text-left shadow-sm transition-colors hover:border-border hover:bg-muted/40 disabled:opacity-60"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white">
                <RiSparklingLine className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  Pregúntale a Celite IA
                </p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  Asistente con IA — responde con los datos reales de tu cuenta.
                </p>
              </div>
              <RiArrowRightSLine className="size-5 shrink-0 text-muted-foreground" />
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onToggleMenu}
        disabled={isOpening}
        aria-expanded={menuOpen}
        aria-label={menuOpen ? "Cerrar menú de ayuda" : "Abrir asistente"}
        className={cn(
          "flex size-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-transform hover:bg-blue-700 hover:scale-105 active:scale-95 disabled:opacity-70",
          menuOpen && "rotate-0"
        )}
      >
        {menuOpen ? (
          <RiCloseLine className="size-6" />
        ) : (
          <svg
            viewBox="0 0 24 24"
            className="size-7"
            fill="currentColor"
            aria-hidden
          >
            <path d="M12 3c-4.97 0-9 3.58-9 8 0 2.3 1.13 4.37 2.93 5.8L5 21l4.35-1.74C10.2 19.75 11.08 20 12 20c4.97 0 9-3.58 9-8s-4.03-9-9-9zm-1.2 11.5h-2.1v-2.1h2.1v2.1zm0-3.5h-2.1V7.5h2.1V11zm4.4 3.5h-2.1v-2.1h2.1v2.1zm0-3.5h-2.1V7.5h2.1V11z" />
          </svg>
        )}
      </button>
    </div>
  )
}
