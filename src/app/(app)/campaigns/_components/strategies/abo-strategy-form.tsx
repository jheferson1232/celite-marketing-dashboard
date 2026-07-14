"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  resolveEffectiveVideoCreatives,
  validateABODynamicFields,
  type ABODynamicCreative,
  type ABODynamicFieldErrors,
  type ABODynamicFields,
  type ABOStrategyConfig,
  type CampaignLandingPageRef,
} from "@/lib/config/tiktok-strategies"
import { listCreativesAction } from "@/app/(app)/products/_actions/creatives"
import { CreativeCard } from "@/app/(app)/baul/_components/creative-card"
import { CreativePreviewDialog } from "@/app/(app)/baul/_components/creative-preview-dialog"
import type { CreativeRecord } from "@/lib/services/creative"
import { runServerAction } from "@/lib/server-action"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { CampaignLandingPagesSection } from "../campaign-landing-pages-section"

const EMPTY_CREATIVES: CreativeRecord[] = []

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
  onChange: (payload: AboStrategyFormPayload) => void
  onValidationChange?: (valid: boolean, errors: ABODynamicFieldErrors) => void
}

export function AboStrategyForm({
  config,
  variantId,
  variantName,
  selectedTikTokVideoIds = [],
  disabled = false,
  onChange,
  onValidationChange,
}: AboStrategyFormProps) {
  const initialDynamic = config.dynamic

  const [budgetPerAdgroup, setBudgetPerAdgroup] = useState(
    String(initialDynamic.budgetPerAdgroup)
  )
  const [autoCreateAdgroupsFromCreatives, setAutoCreateAdgroupsFromCreatives] =
    useState(initialDynamic.autoCreateAdgroupsFromCreatives)
  const [selectedCreativeIds, setSelectedCreativeIds] = useState<string[]>(
    initialDynamic.selectedCreativeIds
  )
  const [landingPageId, setLandingPageId] = useState<string>(
    initialDynamic.landingPageId ?? ""
  )
  const [landingPages, setLandingPages] = useState(config.landingPages)
  const [adText, setAdText] = useState(initialDynamic.adText)
  const [previewCreative, setPreviewCreative] = useState<CreativeRecord | null>(null)

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

    if (!landingPageId || !landingPages.some((page) => page.id === landingPageId)) {
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
  }, [initialDynamic.landingPageId, initialDynamic.landingPageUrl, landingPages])

  useEffect(() => {
    setSelectedCreativeIds((current) =>
      current.filter((id) => videoCreativeRecords.some((creative) => creative.id === id))
    )
  }, [variantId, videoCreativeRecords])

  useEffect(() => {
    if (!autoCreateAdgroupsFromCreatives) return

    setSelectedCreativeIds((current) => {
      const nextIds = videoCreatives.map((creative) => creative.id)
      if (
        current.length === nextIds.length &&
        current.every((id, index) => id === nextIds[index])
      ) {
        return current
      }
      return nextIds
    })
  }, [autoCreateAdgroupsFromCreatives, videoCreatives])

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
      autoCreateAdgroupsFromCreatives,
      selectedCreativeIds,
      selectedTikTokVideoIds,
      landingPageId:
        landing?.id === "legacy-landing" ? initialDynamic.landingPageId : landing?.id ?? null,
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
    autoCreateAdgroupsFromCreatives,
    budgetPerAdgroup,
    initialDynamic.landingPageId,
    initialDynamic.landingPageUrl,
    landingPages,
    landingOptions,
    landingPageId,
    selectedCreativeIds,
    selectedTikTokVideoIds,
    variantId,
    variantName,
    videoCreatives,
  ])

  const previewVideos = useMemo(() => {
    const selectedLanding =
      landingOptions.find((page) => page.id === landingPageId) ??
      landingOptions[0] ??
      null

    const dynamic: ABODynamicFields = {
      variantId,
      variantName,
      budgetPerAdgroup: Number.parseFloat(budgetPerAdgroup) || 0,
      autoCreateAdgroupsFromCreatives,
      selectedCreativeIds,
      selectedTikTokVideoIds,
      landingPageId:
        selectedLanding?.id === "legacy-landing"
          ? initialDynamic.landingPageId
          : selectedLanding?.id ?? null,
      landingPageUrl: selectedLanding?.url ?? initialDynamic.landingPageUrl,
      adText,
    }

    return resolveEffectiveVideoCreatives(
      { budget: 0, landingPages, creatives: videoCreatives },
      dynamic
    )
  }, [
    adText,
    autoCreateAdgroupsFromCreatives,
    budgetPerAdgroup,
    initialDynamic.landingPageId,
    initialDynamic.landingPageUrl,
    landingOptions,
    landingPageId,
    landingPages,
    selectedCreativeIds,
    selectedTikTokVideoIds,
    variantId,
    variantName,
    videoCreatives,
  ])

  const toggleCreative = (creativeId: string, checked: boolean) => {
    setSelectedCreativeIds((current) => {
      if (checked) {
        if (current.includes(creativeId)) return current
        return [...current, creativeId]
      }
      return current.filter((id) => id !== creativeId)
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="abo-budget" className="text-sm font-medium">
          Presupuesto por conjunto (COP)
        </label>
        <Input
          id="abo-budget"
          type="number"
          min={0}
          step={1000}
          value={budgetPerAdgroup}
          disabled={disabled}
          onChange={(event) => setBudgetPerAdgroup(event.target.value)}
        />
      </div>

      <div className="flex items-start justify-between gap-4 rounded-lg border px-3 py-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">
            ¿Crear {videoCreatives.length} conjunto(s) con los videos del Baúl?
          </p>
          <p className="text-xs text-muted-foreground">
            Si está activo, se generará un conjunto por cada video del Baúl.
            Si no, podrás elegir manualmente los creativos.
          </p>
        </div>
        <Switch
          checked={autoCreateAdgroupsFromCreatives}
          disabled={disabled || videoCreatives.length === 0}
          onCheckedChange={(checked) => setAutoCreateAdgroupsFromCreatives(checked === true)}
          aria-label="Crear conjuntos automáticamente con los videos del Baúl"
        />
      </div>

      {!autoCreateAdgroupsFromCreatives ? (
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Videos del Baúl</label>
            <p className="text-xs text-muted-foreground">
              Selecciona los videos para crear un conjunto por cada uno. Haz clic en
              una tarjeta para verla en grande.
            </p>
          </div>

          {videoCreativeRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {variantId
                ? "No hay videos del Baúl vinculados a esta variante."
                : "Selecciona una variante o sube videos en el Baúl antes de continuar."}
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
                      id={`creative-${creative.id}`}
                      checked={checked}
                      disabled={disabled}
                      aria-label={`Seleccionar ${creative.name ?? "video"}`}
                      className={cn(
                        "absolute right-2 top-2 z-10 border-background bg-background/90 shadow-sm",
                        checked && "border-primary data-[state=checked]:bg-primary"
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
      ) : null}

      <CampaignLandingPagesSection
        landingPages={landingPages}
        selectedLandingPageId={landingPageId}
        disabled={disabled}
        onLandingPagesChange={setLandingPages}
        onSelectLandingPage={setLandingPageId}
      />

      <div className="space-y-2">
        <label htmlFor="abo-ad-text" className="text-sm font-medium">
          Texto del anuncio
        </label>
        <textarea
          id="abo-ad-text"
          rows={3}
          value={adText}
          disabled={disabled}
          onChange={(event) => setAdText(event.target.value)}
          className={cn(
            "border-input bg-background w-full rounded-md border px-3 py-2 text-sm shadow-xs",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
        />
      </div>

      <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Vista previa de conjuntos</p>
        <p className="mt-1">
          {previewVideos.length} conjunto(s) · presupuesto {budgetPerAdgroup || "0"}{" "}
          COP c/u
        </p>
        {previewVideos.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {previewVideos.map((video, index) => (
              <li key={video.id} className="truncate">
                {index + 1}. {video.name ?? "Video"} · {video.url}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-destructive">
            Se necesita al menos un video para generar conjuntos en TikTok.
          </p>
        )}
      </div>
    </div>
  )
}
