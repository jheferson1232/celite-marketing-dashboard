"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  CBO_ADGROUP_PRESETS,
  validateCBODynamicFields,
  type ABODynamicCreative,
  type CBODynamicFieldErrors,
  type CBODynamicFields,
  type CBOStrategyConfig,
  type CampaignLandingPageRef,
} from "@/lib/config/tiktok-strategies"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { CampaignLandingPagesSection } from "../campaign-landing-pages-section"
import { useTikTokTestAccount } from "../use-tiktok-test-account"

const NO_CREATIVES: ABODynamicCreative[] = []

export type CboStrategyFormPayload = {
  dynamic: CBODynamicFields
  landingPages: CampaignLandingPageRef[]
  creatives: ABODynamicCreative[]
}

interface CboStrategyFormProps {
  config: CBOStrategyConfig
  variantId: string
  variantName: string
  selectedTikTokVideoIds?: string[]
  disabled?: boolean
  /** Si se pasa, el card de landing se renderiza ahí (p. ej. debajo de Guardar). */
  landingPortalTarget?: HTMLElement | null
  onChange: (payload: CboStrategyFormPayload) => void
  onValidationChange?: (valid: boolean, errors: CBODynamicFieldErrors) => void
}

export function CboStrategyForm({
  config,
  variantId,
  variantName,
  selectedTikTokVideoIds = [],
  disabled = false,
  landingPortalTarget = null,
  onChange,
  onValidationChange,
}: CboStrategyFormProps) {
  const { account: testAccount, currency, currencyLabel } = useTikTokTestAccount()
  const initialDynamic = config.dynamic

  const [campaignBudget, setCampaignBudget] = useState(
    String(initialDynamic.campaignBudget || 300)
  )
  const [selectedPresetIds, setSelectedPresetIds] = useState<string[]>(
    initialDynamic.selectedPresetIds.length > 0
      ? initialDynamic.selectedPresetIds
      : CBO_ADGROUP_PRESETS.map((preset) => preset.id)
  )
  const [landingPageId, setLandingPageId] = useState<string>(
    initialDynamic.landingPageId ?? ""
  )
  const [landingPages, setLandingPages] = useState(config.landingPages)
  const adText = initialDynamic.adText
  const videoCreatives = NO_CREATIVES

  const onChangeRef = useRef(onChange)
  const onValidationChangeRef = useRef(onValidationChange)
  const lastPayloadKeyRef = useRef<string | null>(null)
  const lastValidationKeyRef = useRef<string | null>(null)

  onChangeRef.current = onChange
  onValidationChangeRef.current = onValidationChange

  useEffect(() => {
    if (landingPages.length === 0) {
      if (landingPageId) setLandingPageId("")
      return
    }

    if (
      !landingPageId ||
      !landingPages.some((page) => page.id === landingPageId)
    ) {
      setLandingPageId(landingPages[0]?.id ?? "")
    }
  }, [landingPageId, landingPages])

  const landingOptions = useMemo(() => {
    const pages = [...landingPages]
    if (
      initialDynamic.landingPageUrl &&
      !pages.some((page) => page.url === initialDynamic.landingPageUrl)
    ) {
      pages.unshift({
        id: initialDynamic.landingPageId ?? "legacy-landing",
        url: initialDynamic.landingPageUrl,
      })
    }
    return pages
  }, [
    initialDynamic.landingPageId,
    initialDynamic.landingPageUrl,
    landingPages,
  ])

  useEffect(() => {
    const parsedBudget = Number.parseFloat(campaignBudget)
    const landing =
      landingOptions.find((page) => page.id === landingPageId) ??
      landingOptions[0] ??
      null

    const dynamic: CBODynamicFields = {
      variantId,
      variantName,
      campaignBudget: Number.isFinite(parsedBudget) ? parsedBudget : 0,
      selectedPresetIds,
      selectedCreativeIds: [],
      selectedTikTokVideoIds,
      landingPageId:
        landing?.id === "legacy-landing"
          ? initialDynamic.landingPageId
          : (landing?.id ?? null),
      landingPageUrl: landing?.url ?? initialDynamic.landingPageUrl,
      adText: adText.trim(),
    }

    const context = {
      budget: 0,
      landingPages,
      creatives: videoCreatives,
    }

    const payload = {
      dynamic,
      landingPages,
      creatives: videoCreatives,
    }

    const payloadKey = JSON.stringify(payload)
    if (payloadKey !== lastPayloadKeyRef.current) {
      lastPayloadKeyRef.current = payloadKey
      onChangeRef.current(payload)
    }

    const validation = validateCBODynamicFields(dynamic, context)
    const validationKey = JSON.stringify({
      valid: validation.valid,
      errors: validation.errors,
    })
    if (validationKey !== lastValidationKeyRef.current) {
      lastValidationKeyRef.current = validationKey
      onValidationChangeRef.current?.(validation.valid, validation.errors)
    }
  }, [
    adText,
    campaignBudget,
    initialDynamic.landingPageId,
    initialDynamic.landingPageUrl,
    landingOptions,
    landingPageId,
    landingPages,
    selectedPresetIds,
    selectedTikTokVideoIds,
    variantId,
    variantName,
    videoCreatives,
  ])

  const togglePreset = (presetId: string, checked: boolean) => {
    setSelectedPresetIds((current) => {
      if (checked) {
        if (current.includes(presetId)) return current
        return [...current, presetId]
      }
      return current.filter((id) => id !== presetId)
    })
  }

  const landingSection = (
    <CampaignLandingPagesSection
      landingPages={landingPages}
      selectedLandingPageId={landingPageId}
      disabled={disabled}
      onLandingPagesChange={setLandingPages}
      onSelectLandingPage={setLandingPageId}
    />
  )

  return (
    <div className="space-y-6">
      {landingPortalTarget
        ? createPortal(landingSection, landingPortalTarget)
        : null}
      <p className="text-xs text-muted-foreground">
        Cada video se replica en los conjuntos de interés. Ejemplo: 2 videos × 3
        intereses = 6 conjuntos. Presupuesto diario a nivel de campaña.
      </p>

      <div className="space-y-2">
        <label htmlFor="cbo-budget" className="text-sm font-medium">
          Presupuesto de campaña ({currencyLabel}/día)
        </label>
        <Input
          id="cbo-budget"
          type="number"
          min={0}
          step={currency === "COP" ? 1000 : 1}
          value={campaignBudget}
          disabled={disabled}
          onChange={(event) => setCampaignBudget(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {testAccount
            ? `Moneda de ${testAccount.name}, cuenta default de testeos.`
            : "Moneda de la cuenta default de testeos."}
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">Conjuntos por interés</p>
          <p className="text-xs text-muted-foreground">
            Por cada video se crea un conjunto con cada interés marcado.
          </p>
        </div>
        <div className="space-y-2">
          {CBO_ADGROUP_PRESETS.map((preset) => {
            const checked = selectedPresetIds.includes(preset.id)
            return (
              <label
                key={preset.id}
                className="flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3"
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={(value) =>
                    togglePreset(preset.id, value === true)
                  }
                  aria-label={preset.name}
                />
                <span className="space-y-0.5">
                  <span className="block text-sm font-medium">{preset.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {preset.interestCategoryIds.length > 0
                      ? `Interés TikTok: ${preset.interestCategoryIds.join(", ")}`
                      : "Sin intereses (audiencia amplia)"}
                  </span>
                </span>
              </label>
            )
          })}
        </div>
      </div>

      {landingPortalTarget ? null : landingSection}
    </div>
  )
}
