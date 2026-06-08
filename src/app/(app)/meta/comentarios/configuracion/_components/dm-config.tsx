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

export function ConversationalSaleConfigPanel() {
  const { query, mutation } = useMetaCommentAgentSettings()
  const [enabled, setEnabled] = useState(false)
  const [prompt, setPrompt] = useState("")
  const [dataToCollect, setDataToCollect] = useState("")
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!query.data) return
    setEnabled(query.data.dmReplyEnabled)
    setPrompt(query.data.dmReplyPrompt ?? "")
    setDataToCollect(query.data.dmDataToCollect ?? "")
    setDirty(false)
  }, [query.data])

  if (query.isLoading) {
    return <Skeleton className="h-[28rem] rounded-2xl" />
  }

  return (
    <ConfigCard
      title="Venta conversacional (respuestas internas)"
      footer={
        <ConfigSaveFooter
          savedLabel={dirty ? "Cambios sin guardar" : "Todo guardado"}
          saving={mutation.isPending}
          onSave={() =>
            mutation.mutate({
              dmReplyEnabled: enabled,
              dmReplyPrompt: prompt || null,
              dmDataToCollect: dataToCollect || null,
            })
          }
        />
      }
    >
      <ConfigToggle
        label="¿Deseas que la IA le responda al cliente al interno?"
        hint="Respuestas por mensaje directo (requiere permisos adicionales de Meta)"
        checked={enabled}
        onCheckedChange={(v) => {
          setEnabled(v)
          setDirty(true)
        }}
      />

      <div className="space-y-2">
        <ConfigFieldLabel>Prompt de respuesta interna</ConfigFieldLabel>
        <CharTextarea
          value={prompt}
          onChange={(v) => {
            setPrompt(v)
            setDirty(true)
          }}
          maxLength={8000}
          rows={10}
          placeholder="Usa {NOMBRE_PRODUCTO} y {DESCRIPCION_PRODUCTO} como variables"
        />
      </div>

      <div className="space-y-2">
        <ConfigFieldLabel hint="Separados por punto y coma">
          Datos que la IA debería solicitar al cliente para completar la compra
        </ConfigFieldLabel>
        <CharTextarea
          value={dataToCollect}
          onChange={(v) => {
            setDataToCollect(v)
            setDirty(true)
          }}
          maxLength={200}
          rows={3}
          placeholder="Nombre; Dirección; Ciudad; ..."
        />
      </div>
    </ConfigCard>
  )
}
