"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { RiArrowLeftLine, RiCameraLine, RiSave3Line } from "@remixicon/react"
import { runServerAction } from "@/lib/server-action"
import { uploadCreativeFileClient } from "@/lib/services/blob/creative-client-upload"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import type { MetaCommentProductRecord } from "@/lib/services/meta/comments/products"
import {
  createMetaCommentProductAction,
  updateMetaCommentProductAction,
} from "../../_actions/meta-comments-config"
import { CharTextarea, ConfigFieldLabel } from "../../configuracion/_components/config-form-parts"
import { TagInput } from "./tag-input"

export function MetaCommentProductForm({
  initial,
}: {
  initial?: MetaCommentProductRecord | null
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const isEdit = Boolean(initial?.id)

  const [name, setName] = useState(initial?.name ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "")
  const [tags, setTags] = useState<string[]>(initial?.tags ?? [])
  const [active, setActive] = useState(initial?.active ?? false)
  const [uploading, setUploading] = useState(false)

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        description,
        imageUrl: imageUrl || null,
        tags,
        active,
      }
      if (isEdit && initial) {
        return runServerAction(
          updateMetaCommentProductAction({ id: initial.id, data: payload })
        )
      }
      return runServerAction(createMetaCommentProductAction(payload))
    },
    onSuccess: () => {
      router.push("/meta/comentarios/productos")
      router.refresh()
    },
  })

  async function onFileSelected(file: File | undefined) {
    if (!file) return
    setUploading(true)
    try {
      const result = await uploadCreativeFileClient(file)
      setImageUrl(result.url)
    } finally {
      setUploading(false)
    }
  }

  const canSave = name.trim().length > 0 && description.trim().length > 0

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 lg:p-8">
      <Link
        href="/meta/comentarios/productos"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <RiArrowLeftLine className="size-4" />
        Volver a productos
      </Link>

      <h1 className="text-center text-2xl font-semibold">
        {isEdit ? "Editar comentario / producto" : "Agregar nuevo producto"}
      </h1>

      <div className="grid gap-6 rounded-2xl border bg-card p-5 shadow-sm lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="font-medium">Imagen del producto</h2>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="border-muted-foreground/30 hover:border-primary/50 flex min-h-48 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 p-4 transition-colors"
          >
            {imageUrl ? (
              <div className="relative h-40 w-full">
                <Image
                  src={imageUrl}
                  alt="Vista previa"
                  fill
                  className="rounded-lg object-contain"
                  unoptimized
                />
              </div>
            ) : (
              <>
                <RiCameraLine className="text-muted-foreground size-10" />
                <p className="text-muted-foreground text-center text-sm">
                  Arrastra y suelta una imagen aquí o haz click para seleccionar
                </p>
              </>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onFileSelected(e.target.files?.[0])}
          />
          {uploading ? (
            <p className="text-muted-foreground text-xs">Subiendo imagen...</p>
          ) : null}
        </div>

        <div className="space-y-4">
          <h2 className="font-medium">Información del comentario</h2>

          <div className="space-y-2">
            <ConfigFieldLabel required hint="Nombre visible del producto">
              Nombre del comentario
            </ConfigFieldLabel>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Libro de Recetas Mágicas Volumen 1"
            />
          </div>

          <div className="space-y-2">
            <ConfigFieldLabel required hint="Precio, variaciones y enlace">
              Descripción del producto
            </ConfigFieldLabel>
            <CharTextarea
              value={description}
              onChange={setDescription}
              maxLength={500}
              rows={4}
              placeholder="Indica el precio, información adicional, variaciones, y enlace del producto."
            />
          </div>

          <div className="space-y-2">
            <ConfigFieldLabel hint="Tags para relacionar con posts">
              Cómo relacionar el post
            </ConfigFieldLabel>
            <TagInput tags={tags} onChange={setTags} />
          </div>

          <div className="flex items-center justify-between rounded-xl border px-4 py-3">
            <span className="text-sm font-medium">Estado</span>
            <div className="flex items-center gap-2 text-sm">
              <span className={!active ? "font-medium" : "text-muted-foreground"}>
                Inactivo
              </span>
              <Switch checked={active} onCheckedChange={setActive} />
              <span className={active ? "font-medium" : "text-muted-foreground"}>
                Activo
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          disabled={!canSave || saveMutation.isPending || uploading}
          onClick={() => saveMutation.mutate()}
        >
          <RiSave3Line className="size-4" />
          Guardar comentario
        </Button>
      </div>
    </div>
  )
}
