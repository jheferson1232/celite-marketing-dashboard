"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useQuery } from "@tanstack/react-query"
import {
  CBO_ADGROUP_PRESETS,
  validateCBODynamicFields,
  type ABODynamicCreative,
  type CBODynamicFieldErrors,
  type CBODynamicFields,
  type CBOStrategyConfig,
  type CampaignLandingPageRef,
} from "@/lib/config/tiktok-strategies"
import { listCreativesAction } from "@/app/(app)/products/_actions/creatives"
import { CreativeCard } from "@/app/(app)/baul/_components/creative-card"
import { CreativePreviewDialog } from "@/app/(app)/baul/_components/creative-preview-dialog"
import type { CreativeRecord } from "@/lib/services/creative"
import { runServerAction } from "@/lib/server-action"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { CampaignLandingPagesSection } from "../campaign-landing-pages-section"

const EMPTY_CREATIVES: CreativeRecord[] = []

function legacyCreativeIds(dynamic: CBODynamicFields): string[] {
  if (dynamic.selectedCreativeIds?.length) return dynamic.selectedCreativeIds
  const legacy = (
    dynamic as CBODynamicFields & { selectedCreativeId?: string | null }
  ).selectedCreativeId
  return legacy ? [legacy] : []
}

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
  const initialDynamic = config.dynamic

  const [campaignBudget, setCampaignBudget] = useState(
    String(initialDynamic.campaignBudget || 300)
  )
  const [selectedPresetIds, setSelectedPresetIds] = useState<string[]>(
    initialDynamic.selectedPresetIds.length > 0
      ? initialDynamic.selectedPresetIds
      : CBO_ADGROUP_PRESETS.map((preset) => preset.id)
  )
  const [selectedCreativeIds, setSelectedCreativeIds] = useState<string[]>(() =>
    legacyCreativeIds(initialDynamic)
  )
  const [landingPageId, setLandingPageId] = useState<string>(
    initialDynamic.landingPageId ?? ""
  )
  const [landingPages, setLandingPages] = useState(config.landingPages)
  const [adText, setAdText] = useState(initialDynamic.adText)
  const [previewCreative, setPreviewCreative] = useState<CreativeRecord | null>(
    null
  )

  const usingTikTokVideos = selectedTikTokVideoIds.length > 0

  const onChangeRef = useRef(onChange)
  const onValidationChangeRef = useRef(onValidationChange)
  const lastPayloadKeyRef = useRef<string | null>(null)
  const lastValidationKeyRef = useRef<string | null>(null)

  onChangeRef.current = onChange
  onValidationChangeRef.current = onValidationChange

  const { data: allCreatives } = useQuery({
    queryKey: ["creatives"],
    queryFn: () => runServerAction(listCreativesAction()),
    staleTime: 30 * 1000,
  })

  const videoCreativeRecords = useMemo(() => {
    const records = (allCreatives ?? EMPTY_CREATIVES).filter(
      (creative) => creative.type === "video"
    )

    if (!variantId) return records

    return records.filter((creative) =>
      creative.variants.some((variant) => variant.id === variantId)
    )
  }, [allCreatives, variantId])

  const videoCreatives = useMemo(
    (): ABODynamicCreative[] =>
      videoCreativeRecords.map((creative) => ({
        id: creative.id,
        url: creative.url,
        type: creative.type,
        name: creative.name,
        variantName: creative.variants[0]?.name ?? null,
      })),
    [videoCreativeRecords]
  )

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
    if (usingTikTokVideos) {
      setSelectedCreativeIds([])
      return
    }

    setSelectedCreativeIds((current) =>
      current.filter((id) =>
        videoCreativeRecords.some((creative) => creative.id === id)
      )
    )
  }, [usingTikTokVideos, videoCreativeRecords])

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
      selectedCreativeIds: usingTikTokVideos ? [] : selectedCreativeIds,
      selectedTikTokVideoIds: usingTikTokVideos ? selectedTikTokVideoIds : [],
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
    selectedCreativeIds,
    selectedPresetIds,
    selectedTikTokVideoIds,
    usingTikTokVideos,
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

  const toggleCreative = (creativeId: string, checked: boolean) => {
    setSelectedCreativeIds((current) => {
      if (checked) {
        if (current.includes(creativeId)) return current
        return [...current, creativeId]
      }
      return current.filter((id) => id !== creativeId)
    })
  }

  const selectedPresets = CBO_ADGROUP_PRESETS.filter((preset) =>
    selectedPresetIds.includes(preset.id)
  )
  const videoCount = usingTikTokVideos
    ? selectedTikTokVideoIds.length
    : selectedCreativeIds.length
  const adgroupCount = videoCount * selectedPresets.length

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
          Presupuesto de campaña (COP/día)
        </label>
        <Input
          id="cbo-budget"
          type="number"
          min={0}
          step={1000}
          value={campaignBudget}
          disabled={disabled}
          onChange={(event) => setCampaignBudget(event.target.value)}
        />
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

      {!usingTikTokVideos ? (
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Videos del Baúl</label>
            <p className="text-xs text-muted-foreground">
              Podés elegir varios. Cada uno se combina con los intereses
              seleccionados.
            </p>
          </div>

          {videoCreativeRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {variantId
                ? "No hay videos del Baúl vinculados a esta variante."
                : "Selecciona una variante o sube videos en el Baúl."}
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {videoCreativeRecords.map((creative) => {
                const checked = selectedCreativeIds.includes(creative.id)
                return (
                  <div key={creative.id} className="relative size-[200px]">
                    <CreativeCard
                      creative={creative}
                      selected={checked}
                      showFooter={false}
                      className="size-full"
                      previewClassName="aspect-auto size-[200px]"
                      onOpenPreview={() => setPreviewCreative(creative)}
                    />
                    <Checkbox
                      id={`cbo-creative-${creative.id}`}
                      checked={checked}
                      disabled={disabled}
                      aria-label={`Seleccionar ${creative.name ?? "video"}`}
                      className={cn(
                        "absolute top-2 right-2 z-10 border-background bg-background/90 shadow-sm",
                        checked &&
                          "border-primary data-[state=checked]:bg-primary"
                      )}
                      onCheckedChange={(value) =>
                        toggleCreative(creative.id, value === true)
                      }
                    />
                  </div>
                )
              })}
            </div>
          )}

          <CreativePreviewDialog
            open={previewCreative !== null}
            onOpenChange={(open) => {
              if (!open) setPreviewCreative(null)
            }}
            creative={previewCreative}
          />
        </div>
      ) : (
        <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">
            {selectedTikTokVideoIds.length} post(s) de TikTok
          </p>
          <p className="mt-1">
            Cada post se combina con los intereses CBO (arriba).
          </p>
        </div>
      )}

      {landingPortalTarget ? null : landingSection}

      <div className="space-y-2">
        <label htmlFor="cbo-ad-text" className="text-sm font-medium">
          Texto del anuncio
        </label>
        <textarea
          id="cbo-ad-text"
          rows={3}
          value={adText}
          disabled={disabled}
          onChange={(event) => setAdText(event.target.value)}
          className={cn(
            "w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs",
            "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
        />
      </div>

      <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Vista previa CBO</p>
        <p className="mt-1">
          {videoCount} video(s) × {selectedPresets.length} interés(es) ={" "}
          {adgroupCount} conjunto(s) · presupuesto {campaignBudget || "0"}{" "}
          COP/día (campaña)
        </p>
        {selectedPresets.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {selectedPresets.map((preset) => (
              <li key={preset.id}>{preset.name}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-destructive">
            Selecciona al menos un conjunto de intereses.
          </p>
        )}
      </div>
    </div>
  )
}
