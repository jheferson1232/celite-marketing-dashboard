"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ProductRecord } from "@/lib/services/product"
import { ProductTikTokLaunchPanel } from "./product-tiktok-launch-panel"

interface ProductTikTokLaunchDialogProps {
  product: ProductRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onLaunched?: () => void
  variant?: "kanban" | "edit"
}

export function ProductTikTokLaunchDialog({
  product,
  open,
  onOpenChange,
  onLaunched,
  variant = "edit",
}: ProductTikTokLaunchDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lanzar en TikTok</DialogTitle>
        </DialogHeader>
        {product ? (
          <ProductTikTokLaunchPanel
            product={product}
            variant={variant}
            onClose={() => onOpenChange(false)}
            onLaunched={() => {
              onLaunched?.()
              onOpenChange(false)
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
