"use client"

import { useState } from "react"
import { RiFacebookFill, RiRobotLine } from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type {
  MetaCommentReplyMode,
  MetaMonitoredPageConfig,
} from "@/lib/services/meta/comments/types"

const REPLY_MODE_LABEL: Record<MetaCommentReplyMode, string> = {
  professional: "Profesional",
  friendly: "Cercano",
  concise: "Breve",
}

type EditState = {
  pageId: string
  pageName: string
  replyMode: MetaCommentReplyMode
  replyTemplate: string
  websiteUrl: string
}

export function MetaCommentsReplyConfig({
  pages,
  loading,
  onSave,
  busy,
}: {
  pages: MetaMonitoredPageConfig[] | undefined
  loading: boolean
  onSave: (input: {
    pageId: string
    replyMode: MetaCommentReplyMode
    replyTemplate: string | null
    websiteUrl: string | null
  }) => Promise<void>
  busy: boolean
}) {
  const [edit, setEdit] = useState<EditState | null>(null)

  const monitored = pages?.filter((p) => p.enabled) ?? []

  if (loading) {
    return <Skeleton className="h-64 rounded-2xl" />
  }

  return (
    <>
      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <RiRobotLine className="size-4" />
            </div>
            <div>
              <h2 className="font-semibold">Configuración de respuestas</h2>
              <p className="text-muted-foreground text-sm">
                Tono y plantilla que usa Claude por página
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 p-5">
          {monitored.length ? (
            monitored.map((page) => (
              <div
                key={page.pageId}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                    <RiFacebookFill className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{page.pageName}</p>
                    <p className="text-muted-foreground text-xs">Facebook</p>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium text-emerald-700 dark:text-emerald-400">
                    {REPLY_MODE_LABEL[page.replyMode]}
                  </p>
                  {page.websiteUrl ? (
                    <p className="text-muted-foreground truncate text-xs">
                      {page.websiteUrl}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    setEdit({
                      pageId: page.pageId,
                      pageName: page.pageName,
                      replyMode: page.replyMode,
                      replyTemplate: page.replyTemplate ?? "",
                      websiteUrl: page.websiteUrl ?? "",
                    })
                  }
                >
                  Editar
                </Button>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-8 text-center text-sm">
              Activá páginas en monitoreo para configurar respuestas.
            </p>
          )}
        </div>
      </div>

      <Dialog open={edit != null} onOpenChange={(open) => !open && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Respuestas · {edit?.pageName}</DialogTitle>
          </DialogHeader>
          {edit ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <span className="text-sm font-medium">Tono</span>
                <div className="flex flex-wrap gap-2">
                  {(
                    Object.keys(REPLY_MODE_LABEL) as MetaCommentReplyMode[]
                  ).map((mode) => (
                    <Button
                      key={mode}
                      type="button"
                      size="sm"
                      variant={edit.replyMode === mode ? "default" : "outline"}
                      onClick={() => setEdit({ ...edit, replyMode: mode })}
                    >
                      {REPLY_MODE_LABEL[mode]}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium">Plantilla guía (opcional)</span>
                <Input
                  value={edit.replyTemplate}
                  onChange={(e) =>
                    setEdit({ ...edit, replyTemplate: e.target.value })
                  }
                  placeholder="Ej: Invitá a escribir por DM para tallas y envíos"
                />
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium">Sitio web (opcional)</span>
                <Input
                  value={edit.websiteUrl}
                  onChange={(e) =>
                    setEdit({ ...edit, websiteUrl: e.target.value })
                  }
                  placeholder="https://tu-tienda.com"
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEdit(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!edit || busy}
              onClick={async () => {
                if (!edit) return
                await onSave({
                  pageId: edit.pageId,
                  replyMode: edit.replyMode,
                  replyTemplate: edit.replyTemplate || null,
                  websiteUrl: edit.websiteUrl || null,
                })
                setEdit(null)
              }}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
