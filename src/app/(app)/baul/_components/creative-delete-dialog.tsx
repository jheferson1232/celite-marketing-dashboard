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

interface CreativeDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  creativeLabel: string
  onConfirm: () => void
  isPending?: boolean
}

export function CreativeDeleteDialog({
  open,
  onOpenChange,
  creativeLabel,
  onConfirm,
  isPending = false,
}: CreativeDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>¿Eliminar creative?</DialogTitle>
          <DialogDescription>
            Se eliminará{" "}
            <span className="font-medium text-foreground">{creativeLabel}</span>{" "}
            del baúl y su archivo almacenado. Los productos dejarán de referenciarlo.
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
