"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RiAddLine } from "@remixicon/react"

type ConnectTikTokAccountDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: {
    advertiserId: string
    name?: string
    setAsDefault: boolean
  }) => Promise<void>
  isPending: boolean
}

export function ConnectTikTokAccountDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: ConnectTikTokAccountDialogProps) {
  const [advertiserId, setAdvertiserId] = useState("")
  const [name, setName] = useState("")
  const [setAsDefault, setSetAsDefault] = useState(true)

  function resetForm() {
    setAdvertiserId("")
    setName("")
    setSetAsDefault(true)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    await onSubmit({
      advertiserId: advertiserId.trim(),
      name: name.trim() || undefined,
      setAsDefault,
    })
    resetForm()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar cuenta TikTok Ads</DialogTitle>
          <DialogDescription>
            Pegá el Advertiser ID. Validamos la cuenta contra TikTok antes de
            guardarla.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <label htmlFor="tiktok-advertiser-id" className="text-sm font-medium">
              Advertiser ID
            </label>
            <Input
              id="tiktok-advertiser-id"
              inputMode="numeric"
              placeholder="7647…"
              value={advertiserId}
              onChange={(e) => setAdvertiserId(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="tiktok-account-name" className="text-sm font-medium">
              Nombre (opcional)
            </label>
            <Input
              id="tiktok-account-name"
              placeholder="Ej. HOTEL BOGOTA RESORT"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={setAsDefault}
              onChange={(e) => setSetAsDefault(e.target.checked)}
              className="size-4 rounded border"
            />
            Usar como cuenta predeterminada del dashboard
          </label>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              <RiAddLine />
              {isPending ? "Conectando…" : "Conectar cuenta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
