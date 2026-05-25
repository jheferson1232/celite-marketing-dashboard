"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ProductRecord } from "@/lib/services/product"
import { ProductoCampanasSection } from "./producto-campanas-section"

interface ProductoCampanasDialogProps {
  product: ProductRecord
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProductoCampanasDialog({
  product,
  open,
  onOpenChange,
}: ProductoCampanasDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Campañas</DialogTitle>
          <DialogDescription>
            Vincula campañas externas de TikTok/Meta a este producto.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <ProductoCampanasSection
            product={product}
            enabled={open}
            showHeader={false}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
