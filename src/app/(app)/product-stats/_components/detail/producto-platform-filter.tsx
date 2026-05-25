"use client"

import {
  RiAppsLine,
  RiFacebookCircleFill,
  RiTiktokFill,
} from "@remixicon/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { ProductoPlatformFilter } from "../../_lib/use-producto-platform-filter"

interface ProductoPlatformFilterProps {
  value: ProductoPlatformFilter
  onChange: (value: ProductoPlatformFilter) => void
  className?: string
}

const OPTIONS: {
  value: ProductoPlatformFilter
  label: string
  icon: React.ReactNode
}[] = [
  {
    value: "all",
    label: "Todas",
    icon: <RiAppsLine className="size-3.5 shrink-0" />,
  },
  {
    value: "tiktok",
    label: "TikTok",
    icon: <RiTiktokFill className="size-3.5 shrink-0" />,
  },
  {
    value: "meta",
    label: "Meta",
    icon: (
      <RiFacebookCircleFill className="size-3.5 shrink-0 text-blue-600" />
    ),
  },
]

function getPlatformLabel(value: ProductoPlatformFilter) {
  return OPTIONS.find((option) => option.value === value)?.label ?? "Todas"
}

function getPlatformIcon(value: ProductoPlatformFilter) {
  return OPTIONS.find((option) => option.value === value)?.icon ?? (
    <RiAppsLine className="size-3.5 shrink-0" />
  )
}

export function ProductoPlatformFilter({
  value,
  onChange,
  className,
}: ProductoPlatformFilterProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-7 gap-1.5 px-2 text-xs font-normal",
            value === "all" && "border-primary/50 bg-primary/5",
            className
          )}
        >
          {getPlatformIcon(value)}
          <span className="truncate">{getPlatformLabel(value)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1" align="end">
        <div className="flex flex-col gap-0.5">
          {OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(option.value)}
              className={cn(
                "h-7 justify-start gap-1.5 px-2 text-xs",
                value === option.value && "bg-muted font-medium"
              )}
            >
              {option.icon}
              {option.label}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
