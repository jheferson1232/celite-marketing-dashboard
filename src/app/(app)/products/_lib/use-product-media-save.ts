"use client"

import { useCallback, useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { runServerAction } from "@/lib/server-action"
import type { ProductLandingPageRecord, ProductRecord } from "@/lib/services/product"
import {
  deleteProductMediaAction,
  uploadProductMediaAction,
} from "../_actions/product-media"
import { formatProductReadinessMessage } from "@/lib/products/readiness-messages"
import { saveProductEditAction } from "../_actions/products"
import {
  buildProductMediaFormData,
  type LocalMediaItem,
} from "../_components/product/product-media-picker"

export type ProductMediaFormValues = {
  name: string
  images: string[]
  videos: string[]
  landingPageIds: string[]
  budget: number
}

export type SubmitPhase = "idle" | "uploading" | "saving"

export function useProductMediaSave(product: ProductRecord | undefined) {
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [landingPages, setLandingPages] = useState<ProductLandingPageRecord[]>([])
  const [budget, setBudget] = useState("")
  const [existingImages, setExistingImages] = useState<string[]>([])
  const [existingVideos, setExistingVideos] = useState<string[]>([])
  const [localItems, setLocalItems] = useState<LocalMediaItem[]>([])
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>("idle")
  const [formError, setFormError] = useState<string | null>(null)
  const [saveNotice, setSaveNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!product) return
    setName(product.name)
    setLandingPages(product.landingPages)
    setBudget(product.budget > 0 ? String(product.budget) : "")
    setExistingImages(product.images)
    setExistingVideos(product.videos)
    setLocalItems([])
    setSubmitPhase("idle")
    setFormError(null)
    setSaveNotice(null)
  }, [product])

  const updateMutation = useMutation({
    mutationFn: async (values: ProductMediaFormValues & { id: string }) => {
      const result = await runServerAction(
        saveProductEditAction({
          id: values.id,
          name: values.name,
          images: values.images,
          videos: values.videos,
          landingPageIds: values.landingPageIds,
          budget: values.budget,
        })
      )
      if (!result) throw new Error("No se pudo actualizar el producto")
      return result
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["products"] })
      void queryClient.invalidateQueries({ queryKey: ["product", variables.id] })
    },
  })

  const busy = updateMutation.isPending || submitPhase !== "idle"

  const submitLabel =
    submitPhase === "uploading"
      ? "Subiendo archivos…"
      : submitPhase === "saving"
        ? "Guardando…"
        : "Guardar"

  const save = useCallback(async () => {
      if (!product || !name.trim() || busy) return

      setFormError(null)
      setSaveNotice(null)
      let uploadedUrls: string[] = []

      try {
        let uploadedImages: string[] = []
        let uploadedVideos: string[] = []

        if (localItems.length > 0) {
          setSubmitPhase("uploading")
          const formData = buildProductMediaFormData(localItems, product.id)
          const uploaded = await runServerAction(uploadProductMediaAction(formData))
          if (uploaded) {
            uploadedImages = uploaded.images
            uploadedVideos = uploaded.videos
            uploadedUrls = [...uploaded.images, ...uploaded.videos]
          }
        }

        setSubmitPhase("saving")
        const parsedBudget = budget.trim() === "" ? 0 : Number(budget)
        if (!Number.isFinite(parsedBudget) || parsedBudget < 0) {
          throw new Error("El presupuesto debe ser un número válido mayor o igual a 0")
        }

        const { promotedToReady, readiness, product: saved } =
          await updateMutation.mutateAsync({
            id: product.id,
            name: name.trim(),
            images: [...existingImages, ...uploadedImages],
            videos: [...existingVideos, ...uploadedVideos],
            landingPageIds: landingPages.map((page) => page.id),
            budget: parsedBudget,
          })

        if (promotedToReady) {
          setSaveNotice("Guardado. El producto pasó a Ready (listo para lanzar).")
        } else if (saved.status === "draft" && !readiness.ready) {
          setFormError(formatProductReadinessMessage(readiness.checks))
        } else {
          setSaveNotice("Cambios guardados.")
        }

        for (const item of localItems) {
          URL.revokeObjectURL(item.previewUrl)
        }
        setLocalItems([])
      } catch (error) {
        if (uploadedUrls.length > 0) {
          try {
            await runServerAction(deleteProductMediaAction(uploadedUrls))
          } catch (cleanupError) {
            console.error("No se pudieron limpiar blobs tras error:", cleanupError)
          }
        }
        setFormError(
          error instanceof Error ? error.message : "No se pudo guardar el producto"
        )
      } finally {
        setSubmitPhase("idle")
      }
  }, [
    product,
    name,
    landingPages,
    budget,
    existingImages,
    existingVideos,
    localItems,
    busy,
    updateMutation,
  ])

  return {
    name,
    setName,
    landingPages,
    setLandingPages,
    budget,
    setBudget,
    existingImages,
    setExistingImages,
    existingVideos,
    setExistingVideos,
    localItems,
    setLocalItems,
    formError,
    saveNotice,
    busy,
    saveLabel: submitLabel,
    save,
  }
}
