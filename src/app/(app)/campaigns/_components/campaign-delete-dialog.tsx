"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface CampaignDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaignName: string
  onConfirm: () => void
  isPending?: boolean
}

export function CampaignDeleteDialog({
  open,
  onOpenChange,
  campaignName,
  onConfirm,
  isPending = false,
}: CampaignDeleteDialogProps) {
  if (!open) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>¿Eliminar campaña?</DialogTitle>
          <DialogDescription>
            Se eliminará{" "}
            <span className="font-medium text-foreground">{campaignName}</span> del
            tablero interno. No afecta lo ya publicado en TikTok Ads. Esta acción
            no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? "Eliminando…" : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
