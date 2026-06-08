"use client"

import { RiInformationLine, RiSave3Line } from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function ConfigCard({
  title,
  children,
  footer,
}: {
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      <div className="border-b px-5 py-4">
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="space-y-5 p-5">{children}</div>
      {footer ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
          {footer}
        </div>
      ) : null}
    </div>
  )
}

export function ConfigFieldLabel({
  children,
  required,
  hint,
}: {
  children: React.ReactNode
  required?: boolean
  hint?: string
}) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      <span className="text-sm font-medium">
        {children}
        {required ? <span className="text-destructive ml-0.5">*</span> : null}
      </span>
      {hint ? (
        <span
          title={hint}
          className="text-primary inline-flex"
          aria-label={hint}
        >
          <RiInformationLine className="size-4" />
        </span>
      ) : null}
    </div>
  )
}

export function CharTextarea({
  value,
  onChange,
  maxLength,
  placeholder,
  rows = 5,
  className,
}: {
  value: string
  onChange: (value: string) => void
  maxLength: number
  placeholder?: string
  rows?: number
  className?: string
}) {
  return (
    <div className="relative">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        placeholder={placeholder}
        rows={rows}
        className={cn("pb-6", className)}
      />
      <span className="text-muted-foreground pointer-events-none absolute right-2 bottom-2 text-xs">
        {value.length} / {maxLength}
      </span>
    </div>
  )
}

export function CharInput({
  value,
  onChange,
  maxLength,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  maxLength: number
  placeholder?: string
}) {
  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        placeholder={placeholder}
        className="pr-16"
      />
      <span className="text-muted-foreground pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs">
        {value.length}/{maxLength}
      </span>
    </div>
  )
}

export function ConfigToggle({
  label,
  hint,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string
  hint?: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border px-4 py-3">
      <ConfigFieldLabel hint={hint}>{label}</ConfigFieldLabel>
      <div className="flex items-center gap-2 text-sm">
        <span className={!checked ? "font-medium" : "text-muted-foreground"}>
          No
        </span>
        <Switch
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
        />
        <span className={checked ? "font-medium" : "text-muted-foreground"}>
          Sí
        </span>
      </div>
    </div>
  )
}

export function ConfigSaveFooter({
  savedLabel,
  saving,
  onSave,
}: {
  savedLabel: string
  saving: boolean
  onSave: () => void
}) {
  return (
    <>
      <span className="text-muted-foreground text-sm">{savedLabel}</span>
      <Button type="button" disabled={saving} onClick={onSave}>
        <RiSave3Line className="size-4" />
        Guardar configuración
      </Button>
    </>
  )
}

export const COUNTRY_OPTIONS = [
  { value: "CO", label: "Colombia" },
  { value: "MX", label: "México" },
  { value: "PE", label: "Perú" },
  { value: "CL", label: "Chile" },
  { value: "AR", label: "Argentina" },
  { value: "EC", label: "Ecuador" },
] as const
