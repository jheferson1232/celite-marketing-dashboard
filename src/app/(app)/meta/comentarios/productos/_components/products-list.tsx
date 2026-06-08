"use client"

import Image from "next/image"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  RiAddLine,
  RiArrowLeftLine,
  RiDeleteBinLine,
  RiPencilLine,
} from "@remixicon/react"
import { runServerAction } from "@/lib/server-action"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  deleteMetaCommentProductAction,
  listMetaCommentProductsAction,
} from "../../_actions/meta-comments-config"

export function MetaCommentProductsList() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ["meta-comment-products"],
    queryFn: () => runServerAction(listMetaCommentProductsAction()),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      runServerAction(deleteMetaCommentProductAction(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["meta-comment-products"] })
    },
  })

  return (
    <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/meta/comentarios/configuracion/negocio"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
        >
          <RiArrowLeftLine className="size-4" />
          Configuración del agente
        </Link>
        <Button asChild>
          <Link href="/meta/comentarios/productos/nuevo">
            <RiAddLine className="size-4" />
            Nuevo producto
          </Link>
        </Button>
      </div>

      <div className="text-center">
        <h1 className="text-2xl font-semibold">Productos / comentarios</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Catálogo que el agente usa para responder según cada publicación
        </p>
      </div>

      {query.isLoading ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : query.data?.length ? (
        <div className="mx-auto grid w-full max-w-4xl gap-4">
          {query.data.map((product) => (
            <div
              key={product.id}
              className="flex flex-wrap items-start gap-4 rounded-2xl border bg-card p-4 shadow-sm"
            >
              <div className="bg-muted relative size-20 shrink-0 overflow-hidden rounded-lg">
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="text-muted-foreground flex size-full items-center justify-center text-xs">
                    Sin imagen
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-medium">{product.name}</h2>
                  <Badge variant={product.active ? "default" : "secondary"}>
                    {product.active ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                  {product.description}
                </p>
                {product.tags.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {product.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/meta/comentarios/productos/${product.id}`}>
                    <RiPencilLine className="size-4" />
                    Editar
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (confirm("¿Eliminar este producto?")) {
                      deleteMutation.mutate(product.id)
                    }
                  }}
                >
                  <RiDeleteBinLine className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground mx-auto max-w-md rounded-2xl border border-dashed px-6 py-12 text-center text-sm">
          Aún no hay productos. Creá el primero para que el agente conozca qué
          vender en cada post.
        </p>
      )}
    </div>
  )
}
