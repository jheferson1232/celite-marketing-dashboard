"use client"

import { RiFileCopyLine } from "@remixicon/react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useTikTokManage } from "./tiktok-manage-provider"

interface TikTokDuplicateAdGroupButtonProps {
  adgroupId: string
  adgroupName: string
  campaignId?: string
  accountId?: string
  className?: string
}

export function TikTokDuplicateAdGroupButton({
  adgroupId,
  adgroupName,
  campaignId,
  accountId,
  className,
}: TikTokDuplicateAdGroupButtonProps) {
  const {
    isDuplicatingAdGroup,
    getDuplicateError,
    getDuplicateInfo,
    duplicateAdGroup,
  } = useTikTokManage()
  const pending = isDuplicatingAdGroup(adgroupId)
  const error = getDuplicateError(adgroupId)
  const info = getDuplicateInfo(adgroupId)

  return (
    <div
      className={cn("flex flex-col items-center gap-0.5", className)}
      onClick={(e) => e.stopPropagation()}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={pending}
            aria-label={`Duplicar conjunto ${adgroupName}`}
            onClick={() => {
              const ok = window.confirm(
                `¿Duplicar el conjunto «${adgroupName}»?\n\nSe creará una copia apagada en la misma campaña, con sus anuncios.`
              )
              if (!ok) return
              duplicateAdGroup({ adgroupId, campaignId, accountId })
            }}
          >
            <RiFileCopyLine
              className={cn("size-3.5", pending && "animate-pulse opacity-60")}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {pending ? "Duplicando…" : "Duplicar conjunto"}
        </TooltipContent>
      </Tooltip>
      {error ? (
        <span
          className="text-destructive max-w-[180px] text-center text-[10px] leading-tight"
          title={error}
          role="alert"
        >
          {error}
        </span>
      ) : info ? (
        <span
          className="max-w-[180px] text-center text-[10px] leading-tight text-green-600 dark:text-green-400"
          title={info}
          role="status"
        >
          {info}
        </span>
      ) : null}
    </div>
  )
}
