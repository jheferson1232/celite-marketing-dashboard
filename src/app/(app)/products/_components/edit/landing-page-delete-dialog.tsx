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

interface LandingPageDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  url: string
  onConfirm: () => void
  isPending?: boolean
}

export function LandingPageDeleteDialog({
  open,
  onOpenChange,
  url,
  onConfirm,
  isPending = false,
}: LandingPageDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>¿Eliminar landing page?</DialogTitle>
          <DialogDescription>
            Se eliminará{" "}
            <span className="break-all font-medium text-foreground">{url}</span>{" "}
            del catálogo y se desvinculará de todos los productos. Esta acción no
            se puede deshacer.
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
