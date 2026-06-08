"use client"

import { useState } from "react"
import { RiCloseLine } from "@remixicon/react"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"

export function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}) {
  const [draft, setDraft] = useState("")

  function addTag(raw: string) {
    const value = raw.trim()
    if (!value) return
    if (tags.some((t) => t.toLowerCase() === value.toLowerCase())) return
    onChange([...tags, value])
    setDraft("")
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addTag(draft)
    }
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-sm text-blue-800 dark:text-blue-200">
        Presiona Enter o , para agregar cada tag
      </div>
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => addTag(draft)}
        placeholder={placeholder ?? "Escribe y presiona Enter o coma para agregar..."}
        rows={2}
      />
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1">
              {tag}
              <button
                type="button"
                className="hover:bg-muted rounded p-0.5"
                onClick={() => onChange(tags.filter((t) => t !== tag))}
                aria-label={`Quitar ${tag}`}
              >
                <RiCloseLine className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
      <p className="text-muted-foreground text-xs">
        Ejemplo: &quot;cocina mágica&quot;, &quot;promoción especial&quot;, &quot;oferta
        limitada&quot;
      </p>
    </div>
  )
}
