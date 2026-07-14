"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { RiArrowLeftLine, RiSaveLine } from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { runServerAction } from "@/lib/server-action"
import type {
  ABODynamicFieldErrors,
  ABOStrategyConfig,
} from "@/lib/config/tiktok-strategies"
import type { TikTokStrategyId } from "@/lib/config/tiktok-strategies"
import type { CampaignStatus } from "@/lib/campaigns/status"
import { buildEmptyABOStrategyConfig } from "@/lib/services/campaign-strategy-builder"
import {
  createCampaignAction,
  listTikTokStrategiesAction,
} from "../_actions/campaigns"
import { CampaignGeneralSection } from "./campaign-general-section"
import { CampaignVariantSelect } from "./campaign-variant-select"
import {
  AboStrategyForm,
  type AboStrategyFormPayload,
} from "./strategies/abo-strategy-form"

export function CampaignCreateContent() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [pendingName, setPendingName] = useState("")
  const [pendingStatus, setPendingStatus] = useState<CampaignStatus>("draft")
  const [strategy, setStrategy] = useState<TikTokStrategyId>("ABO")
  const [aboFormKey, setAboFormKey] = useState(0)
  const [pendingVariantId, setPendingVariantId] = useState("")
  const [pendingVariantName, setPendingVariantName] = useState("")
  const [pendingAbo, setPendingAbo] = useState<AboStrategyFormPayload | null>(null)
  const [isAboValid, setIsAboValid] = useState(true)
  const [aboErrors, setAboErrors] = useState<ABODynamicFieldErrors>({})
  const [pendingPixelId, setPendingPixelId] = useState(
    () => buildEmptyABOStrategyConfig("").campaign.pixel_id
  )
  const [pendingAuthCode, setPendingAuthCode] = useState("")
  const [pendingTikTokVideoIds, setPendingTikTokVideoIds] = useState<string[]>([])

  const { data: strategies = [] } = useQuery({
    queryKey: ["tiktok-strategies"],
    queryFn: () => runServerAction(listTikTokStrategiesAction()),
    staleTime: 60 * 60 * 1000,
  })

  const aboConfig = useMemo(
    () => buildEmptyABOStrategyConfig(""),
    [aboFormKey]
  )

  const handleAboChange = useCallback((payload: AboStrategyFormPayload) => {
    setPendingAbo(payload)
  }, [])

  const handleValidationChange = useCallback(
    (valid: boolean, errors: ABODynamicFieldErrors) => {
      setIsAboValid(valid)
      setAboErrors(errors)
    },
    []
  )

  const createMutation = useMutation({
    mutationFn: async () => {
      if (strategy !== "ABO" || !pendingAbo) {
        throw new Error("Completa la configuración de la estrategia")
      }

      return runServerAction(
        createCampaignAction({
          name: pendingName.trim(),
          status: pendingStatus,
          strategy,
          pixelId: pendingPixelId,
          authCode: pendingAuthCode.trim() || undefined,
          aboDynamic: {
            ...pendingAbo.dynamic,
            variantId: pendingVariantId,
            variantName: pendingVariantName,
            selectedTikTokVideoIds: pendingTikTokVideoIds,
          },
          aboLandingPages: pendingAbo.landingPages,
          aboCreatives: pendingAbo.creatives,
        })
      )
    },
    onSuccess: (campaign) => {
      if (!campaign) return
      void queryClient.invalidateQueries({ queryKey: ["campaigns"] })
      router.push(`/campaigns/${campaign.id}`)
    },
  })

  const canSave =
    pendingName.trim().length > 0 &&
    pendingPixelId.trim().length > 0 &&
    strategy === "ABO" &&
    pendingAbo !== null &&
    isAboValid &&
    !createMutation.isPending

  return (
    <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
            <Link href="/campaigns">
              <RiArrowLeftLine className="size-4" />
              Campaigns
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {pendingName.trim() || "Nueva campaña"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Configura la campaña antes de guardarla.
            </p>
          </div>
        </div>

        <Button
          type="button"
          disabled={!canSave}
          onClick={() => createMutation.mutate()}
        >
          <RiSaveLine className="size-4" />
          {createMutation.isPending ? "Guardando…" : "Guardar"}
        </Button>
      </div>

      {createMutation.isError ? (
        <p className="text-sm text-destructive">
          {createMutation.error instanceof Error
            ? createMutation.error.message
            : "No se pudo crear la campaña"}
        </p>
      ) : null}

      <CampaignGeneralSection
        name={pendingName}
        status={pendingStatus}
        pixelId={pendingPixelId}
        authCode={pendingAuthCode}
        selectedTikTokVideoIds={pendingTikTokVideoIds}
        disabled={createMutation.isPending}
        onNameChange={setPendingName}
        onStatusChange={setPendingStatus}
        onPixelIdChange={setPendingPixelId}
        onAuthCodeChange={setPendingAuthCode}
        onSelectedTikTokVideoIdsChange={setPendingTikTokVideoIds}
      />

      <section className="max-w-2xl space-y-4 rounded-xl border bg-muted/10 p-4">
        <div>
          <h2 className="text-sm font-semibold">Estrategia</h2>
          <p className="text-xs text-muted-foreground">
            Configuración específica según la estrategia seleccionada.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="campaign-create-strategy" className="text-sm font-medium">
            Tipo de estrategia
          </label>
          <select
            id="campaign-create-strategy"
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            value={strategy}
            disabled={createMutation.isPending}
            onChange={(event) => {
              const nextStrategy = event.target.value as TikTokStrategyId
              if (nextStrategy === strategy) return
              setStrategy(nextStrategy)
              setPendingAbo(null)
              setPendingVariantId("")
              setPendingVariantName("")
              setAboFormKey((key) => key + 1)
            }}
          >
            {strategies.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            {strategies.find((entry) => entry.id === strategy)?.description}
          </p>
        </div>

        {strategy === "ABO" ? (
          <CampaignVariantSelect
            value={pendingVariantId}
            disabled={createMutation.isPending}
            onChange={(variantId, variantName) => {
              setPendingVariantId(variantId)
              setPendingVariantName(variantName)
            }}
          />
        ) : null}

        {strategy === "ABO" ? (
          <>
            <AboStrategyForm
              key={aboFormKey}
              config={aboConfig as ABOStrategyConfig}
              variantId={pendingVariantId}
              variantName={pendingVariantName}
              selectedTikTokVideoIds={pendingTikTokVideoIds}
              disabled={createMutation.isPending}
              onChange={handleAboChange}
              onValidationChange={handleValidationChange}
            />
            {!isAboValid ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {Object.values(aboErrors)[0] ?? "Revisa la configuración ABO"}
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Estrategia no soportada todavía en el formulario.
          </p>
        )}
      </section>
    </div>
  )
}
