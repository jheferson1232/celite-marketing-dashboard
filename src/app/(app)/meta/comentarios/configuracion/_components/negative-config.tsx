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

export function NegativeCommentsConfigPanel() {
  const { query, mutation } = useMetaCommentAgentSettings()
  const [enabled, setEnabled] = useState(true)
  const [prompt, setPrompt] = useState("")
  const [examplesRemove, setExamplesRemove] = useState("")
  const [examplesKeep, setExamplesKeep] = useState("")
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!query.data) return
    setEnabled(query.data.deleteNegativeEnabled)
    setPrompt(query.data.deletePrompt ?? "")
    setExamplesRemove(query.data.deleteExamplesRemove ?? "")
    setExamplesKeep(query.data.deleteExamplesKeep ?? "")
    setDirty(false)
  }, [query.data])

  if (query.isLoading) {
    return <Skeleton className="h-[32rem] rounded-2xl" />
  }

  return (
    <ConfigCard
      title="Comentarios negativos"
      footer={
        <ConfigSaveFooter
          savedLabel={dirty ? "Cambios sin guardar" : "Todo guardado"}
          saving={mutation.isPending}
          onSave={() =>
            mutation.mutate({
              deleteNegativeEnabled: enabled,
              deletePrompt: prompt || null,
              deleteExamplesRemove: examplesRemove || null,
              deleteExamplesKeep: examplesKeep || null,
            })
          }
        />
      }
    >
      <ConfigToggle
        label="¿Deseas eliminar comentarios negativos?"
        hint="Si está activo, el agente ocultará spam, insultos y comentarios negativos"
        checked={enabled}
        onCheckedChange={(v) => {
          setEnabled(v)
          setDirty(true)
        }}
      />

      <div className="space-y-2">
        <ConfigFieldLabel>Prompt de eliminación de comentarios</ConfigFieldLabel>
        <CharTextarea
          value={prompt}
          onChange={(v) => {
            setPrompt(v)
            setDirty(true)
          }}
          maxLength={10000}
          rows={8}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <ConfigFieldLabel>Ejemplos de comentarios a eliminar</ConfigFieldLabel>
          <CharTextarea
            value={examplesRemove}
            onChange={(v) => {
              setExamplesRemove(v)
              setDirty(true)
            }}
            maxLength={1000}
            rows={6}
          />
        </div>
        <div className="space-y-2">
          <ConfigFieldLabel>
            Ejemplos de comentarios que no se deben eliminar
          </ConfigFieldLabel>
          <CharTextarea
            value={examplesKeep}
            onChange={(v) => {
              setExamplesKeep(v)
              setDirty(true)
            }}
            maxLength={1000}
            rows={6}
          />
        </div>
      </div>
    </ConfigCard>
  )
}
