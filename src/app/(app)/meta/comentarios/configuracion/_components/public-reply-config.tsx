"use client"

import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import {
  CharTextarea,
  ConfigCard,
  ConfigFieldLabel,
  ConfigSaveFooter,
  ConfigToggle,
} from "./config-form-parts"
import { useMetaCommentAgentSettings } from "./use-agent-settings"

export function PublicReplyConfigPanel() {
  const { query, mutation } = useMetaCommentAgentSettings()
  const [enabled, setEnabled] = useState(true)
  const [prompt, setPrompt] = useState("")
  const [includeLink, setIncludeLink] = useState(true)
  const [includePrice, setIncludePrice] = useState(true)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!query.data) return
    setEnabled(query.data.publicReplyEnabled)
    setPrompt(query.data.publicReplyPrompt ?? "")
    setIncludeLink(query.data.publicReplyIncludeLink)
    setIncludePrice(query.data.publicReplyIncludePrice)
    setDirty(false)
  }, [query.data])

  if (query.isLoading) {
    return <Skeleton className="h-[28rem] rounded-2xl" />
  }

  return (
    <ConfigCard
      title="Respuesta pública"
      footer={
        <ConfigSaveFooter
          savedLabel={dirty ? "Cambios sin guardar" : "Todo guardado"}
          saving={mutation.isPending}
          onSave={() =>
            mutation.mutate({
              publicReplyEnabled: enabled,
              publicReplyPrompt: prompt || null,
              publicReplyIncludeLink: includeLink,
              publicReplyIncludePrice: includePrice,
            })
          }
        />
      }
    >
      <ConfigToggle
        label="¿Deseas activar la respuesta pública automática?"
        hint="Responde comentarios en el post de forma visible"
        checked={enabled}
        onCheckedChange={(v) => {
          setEnabled(v)
          setDirty(true)
        }}
      />

      <div className="space-y-2">
        <ConfigFieldLabel>Prompt de respuesta pública</ConfigFieldLabel>
        <CharTextarea
          value={prompt}
          onChange={(v) => {
            setPrompt(v)
            setDirty(true)
          }}
          maxLength={3000}
          rows={8}
        />
      </div>

      <div>
        <p className="mb-3 text-sm font-medium">Autorizaciones</p>
        <div className="grid gap-3 md:grid-cols-2">
          <ConfigToggle
            label="¿Deseas que se envíe el enlace en la respuesta pública?"
            checked={includeLink}
            onCheckedChange={(v) => {
              setIncludeLink(v)
              setDirty(true)
            }}
          />
          <ConfigToggle
            label="¿Deseas que se envíe el precio en la respuesta pública?"
            checked={includePrice}
            onCheckedChange={(v) => {
              setIncludePrice(v)
              setDirty(true)
            }}
          />
        </div>
      </div>
    </ConfigCard>
  )
}
