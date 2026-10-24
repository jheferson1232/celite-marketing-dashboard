"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  validateABODynamicFields,
  type ABODynamicCreative,
  type ABODynamicFieldErrors,
  type ABODynamicFields,
  type ABOStrategyConfig,
  type CampaignLandingPageRef,
} from "@/lib/config/tiktok-strategies"
import { Input } from "@/components/ui/input"
import { CampaignLandingPagesSection } from "../campaign-landing-pages-section"
import { useTikTokTestAccount } from "../use-tiktok-test-account"

const NO_CREATIVES: ABODynamicCreative[] = []

export type AboStrategyFormPayload = {
  dynamic: ABODynamicFields
  landingPages: CampaignLandingPageRef[]
  creatives: ABODynamicCreative[]
}

interface AboStrategyFormProps {
  config: ABOStrategyConfig
  variantId: string
  variantName: string
  selectedTikTokVideoIds?: string[]
  disabled?: boolean
  /** Si se pasa, el card de landing se renderiza ahí (p. ej. debajo de Guardar). */
  landingPortalTarget?: HTMLElement | null
  onChange: (payload: AboStrategyFormPayload) => void
  onValidationChange?: (valid: boolean, errors: ABODynamicFieldErrors) => void
}

export function AboStrategyForm({
  config,
  variantId,
  variantName,
  selectedTikTokVideoIds = [],
  disabled = false,
  landingPortalTarget = null,
  onChange,
  onValidationChange,
}: AboStrategyFormProps) {
  const { account: testAccount, currency, currencyLabel } = useTikTokTestAccount()
  const initialDynamic = config.dynamic

  const [budgetPerAdgroup, setBudgetPerAdgroup] = useState(
    String(initialDynamic.budgetPerAdgroup)
  )
  const [landingPageId, setLandingPageId] = useState<string>(
    initialDynamic.landingPageId ?? ""
  )
  const [landingPages, setLandingPages] = useState(config.landingPages)
  const adText = initialDynamic.adText

  const onChangeRef = useRef(onChange)
  const onValidationChangeRef = useRef(onValidationChange)
  const lastPayloadKeyRef = useRef<string | null>(null)
  const lastValidationKeyRef = useRef<string | null>(null)

  onChangeRef.current = onChange
  onValidationChangeRef.current = onValidationChange

  const videoCreatives = NO_CREATIVES

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
    const parsedBudget = Number.parseFloat(budgetPerAdgroup)
    const landing =
      landingOptions.find((page) => page.id === landingPageId) ??
      landingOptions[0] ??
      null

    const dynamic: ABODynamicFields = {
      variantId,
      variantName,
      budgetPerAdgroup: Number.isFinite(parsedBudget) ? parsedBudget : 0,
      autoCreateAdgroupsFromCreatives: false,
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

    const validation = validateABODynamicFields(dynamic, context)
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
    budgetPerAdgroup,
    initialDynamic.landingPageId,
    initialDynamic.landingPageUrl,
    landingPages,
    landingOptions,
    landingPageId,
    selectedTikTokVideoIds,
    variantId,
    variantName,
    videoCreatives,
  ])

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
      <div className="space-y-2">
        <label htmlFor="abo-budget" className="text-sm font-medium">
          Presupuesto por conjunto ({currencyLabel})
        </label>
        <Input
          id="abo-budget"
          type="number"
          min={0}
          step={currency === "COP" ? 1000 : 1}
          value={budgetPerAdgroup}
          disabled={disabled}
          onChange={(event) => setBudgetPerAdgroup(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {testAccount
            ? `Moneda de ${testAccount.name}, cuenta default de testeos.`
            : "Moneda de la cuenta default de testeos."}
        </p>
      </div>

      {landingPortalTarget ? null : landingSection}
    </div>
  )
}
