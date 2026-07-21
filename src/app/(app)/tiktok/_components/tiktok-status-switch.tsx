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
  const {
    isEntityPending,
    getEntityError,
    getEntityInfo,
    isCampaignQueuedFor6am,
    setEntityStatus,
  } = useTikTokManage()
  const serverActive = getTikTokEntityIsActive(entity)
  const queuedFor6am =
    entity.type === "campaign" && isCampaignQueuedFor6am(entity.id)
  const [optimisticActive, setOptimisticActive] = React.useState<boolean | null>(
    null
  )

  const isPending = isEntityPending(entity)
  const isActive = optimisticActive ?? (queuedFor6am ? false : serverActive)
  const errorMessage = getEntityError(entity)
  const infoMessage = getEntityInfo(entity)

  React.useEffect(() => {
    if (!isPending) {
      setOptimisticActive(null)
    }
  }, [isPending, serverActive, queuedFor6am])

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
          isActive
            ? `Pausar ${entity.name}`
            : queuedFor6am
              ? `${entity.name} en cola 6:00 — encender para activar ya`
              : `Activar ${entity.name}`
        }
        className={cn(isPending && "opacity-60")}
      />
      {errorMessage ? (
        <span className="max-w-[140px] text-center text-[10px] leading-tight text-destructive">
          {errorMessage}
        </span>
      ) : infoMessage || queuedFor6am ? (
        <span className="text-muted-foreground max-w-[140px] text-center text-[10px] leading-tight">
          {infoMessage ?? (queuedFor6am ? "Cola 6AM" : null)}
        </span>
      ) : null}
    </div>
  )
}
