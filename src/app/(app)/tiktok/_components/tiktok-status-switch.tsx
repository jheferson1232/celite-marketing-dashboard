"use client"

import * as React from "react"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import {
  getTikTokEntityIsActive,
  type TikTokManageEntity,
} from "./tiktok-manage-types"
import { useTikTokManage } from "./tiktok-manage-provider"

interface TikTokStatusSwitchProps {
  entity: TikTokManageEntity
}

export function TikTokStatusSwitch({ entity }: TikTokStatusSwitchProps) {
  const { isEntityPending, getEntityError, setEntityStatus } = useTikTokManage()
  const serverActive = getTikTokEntityIsActive(entity)
  const [optimisticActive, setOptimisticActive] = React.useState<boolean | null>(
    null
  )

  const isPending = isEntityPending(entity)
  const isActive = optimisticActive ?? serverActive
  const errorMessage = getEntityError(entity)

  React.useEffect(() => {
    if (!isPending) {
      setOptimisticActive(null)
    }
  }, [isPending, serverActive])

  return (
    <div
      className="flex flex-col items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <Switch
        checked={isActive}
        disabled={isPending}
        onCheckedChange={(checked) => {
          setOptimisticActive(checked)
          setEntityStatus(entity, checked ? "ENABLE" : "DISABLE")
        }}
        aria-label={
          isActive ? `Pausar ${entity.name}` : `Activar ${entity.name}`
        }
        className={cn(isPending && "opacity-60")}
      />
      {errorMessage ? (
        <span className="max-w-[140px] text-center text-[10px] leading-tight text-destructive">
          {errorMessage}
        </span>
      ) : null}
    </div>
  )
}
