"use client"

import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import {
  CharInput,
  CharTextarea,
  COUNTRY_OPTIONS,
  ConfigCard,
  ConfigFieldLabel,
  ConfigSaveFooter,
} from "./config-form-parts"
import { useMetaCommentAgentSettings } from "./use-agent-settings"

export function BusinessConfigPanel() {
  const { query, mutation } = useMetaCommentAgentSettings()
  const [country, setCountry] = useState("CO")
  const [contactInfo, setContactInfo] = useState("")
  const [shippingTime, setShippingTime] = useState("")
  const [businessInfo, setBusinessInfo] = useState("")
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!query.data) return
    setCountry(query.data.country)
    setContactInfo(query.data.contactInfo ?? "")
    setShippingTime(query.data.shippingTime ?? "")
    setBusinessInfo(query.data.businessInfo ?? "")
    setDirty(false)
  }, [query.data])

  if (query.isLoading) {
    return <Skeleton className="h-96 rounded-2xl" />
  }

  const savedLabel = dirty
    ? "Cambios sin guardar"
    : mutation.isSuccess
      ? "Todo guardado"
      : "Todo guardado"

  return (
    <ConfigCard
      title="Información del negocio"
      footer={
        <ConfigSaveFooter
          savedLabel={savedLabel}
          saving={mutation.isPending}
          onSave={() =>
            mutation.mutate({
              country,
              contactInfo: contactInfo || null,
              shippingTime: shippingTime || null,
              businessInfo: businessInfo || null,
            })
          }
        />
      }
    >
      <div className="space-y-2">
        <ConfigFieldLabel hint="País donde opera el negocio">
          País
        </ConfigFieldLabel>
        <select
          value={country}
          onChange={(e) => {
            setCountry(e.target.value)
            setDirty(true)
          }}
          className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {COUNTRY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <ConfigFieldLabel hint="URL de la página o número de WhatsApp">
          Página o número de contacto
        </ConfigFieldLabel>
        <CharInput
          value={contactInfo}
          onChange={(v) => {
            setContactInfo(v)
            setDirty(true)
          }}
          maxLength={200}
          placeholder="https://... o WhatsApp +57..."
        />
      </div>

      <div className="space-y-2">
        <ConfigFieldLabel hint="Tiempos de entrega para mencionar en respuestas">
          Tiempo de envío
        </ConfigFieldLabel>
        <CharInput
          value={shippingTime}
          onChange={(v) => {
            setShippingTime(v)
            setDirty(true)
          }}
          maxLength={200}
          placeholder="Ej: 2-5 días hábiles a nivel nacional"
        />
      </div>

      <div className="space-y-2">
        <ConfigFieldLabel hint="Contexto adicional sobre tu empresa">
          Información adicional del negocio
        </ConfigFieldLabel>
        <CharTextarea
          value={businessInfo}
          onChange={(v) => {
            setBusinessInfo(v)
            setDirty(true)
          }}
          maxLength={500}
          rows={4}
          placeholder="Describe tu negocio, políticas, garantías..."
        />
      </div>
    </ConfigCard>
  )
}
