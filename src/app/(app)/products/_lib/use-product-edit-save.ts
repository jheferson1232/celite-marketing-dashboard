"use client"

import { useCallback, useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { runServerAction } from "@/lib/server-action"
import type { ProductRecord } from "@/lib/services/product"
import { updateProductAction } from "../_actions/products"

export function useProductEditSave(product: ProductRecord | undefined) {
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const [saveNotice, setSaveNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!product) return
    setName(product.name)
    setFormError(null)
    setSaveNotice(null)
  }, [product])

  const invalidateProduct = useCallback(
    (productId: string) => {
      void queryClient.invalidateQueries({ queryKey: ["products"] })
      void queryClient.invalidateQueries({ queryKey: ["product", productId] })
    },
    [queryClient]
  )

  const updateMutation = useMutation({
    mutationFn: async (values: { id: string; name: string }) => {
      const updated = await runServerAction(
        updateProductAction({
          id: values.id,
          name: values.name,
        })
      )
      if (!updated) throw new Error("No se pudo actualizar el producto")
      return updated
    },
    onSuccess: (_, variables) => {
      invalidateProduct(variables.id)
    },
  })

  const busy = updateMutation.isPending

  const save = useCallback(async () => {
    if (!product || !name.trim() || busy) return

    setFormError(null)
    setSaveNotice(null)

    try {
      await updateMutation.mutateAsync({
        id: product.id,
        name: name.trim(),
      })
      setSaveNotice("Cambios guardados.")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo guardar el producto"
      setFormError(message)
    }
  }, [product, name, busy, updateMutation])

  return {
    name,
    setName,
    formError,
    saveNotice,
    busy,
    saveLabel: busy ? "Guardando…" : "Guardar",
    save,
    invalidateProduct,
  }
}
