"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { RiArrowLeftLine, RiRocketLine, RiSaveLine } from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { runServerAction } from "@/lib/server-action"
import type {
  ABODynamicFieldErrors,
  ABOStrategyConfig,
} from "@/lib/config/tiktok-strategies"
import type { TikTokStrategyId } from "@/lib/config/tiktok-strategies"
import type { CampaignStatus } from "@/lib/campaigns/status"
import {
  getCampaignByIdAction,
  listTikTokStrategiesAction,
  updateCampaignDetailAction,
  updateCampaignStrategyAction,
} from "../_actions/campaigns"
import { CampaignGeneralSection } from "./campaign-general-section"
import { CampaignLaunchDialog } from "./campaign-launch-dialog"
import { CampaignVariantSelect } from "./campaign-variant-select"
import {
  AboStrategyForm,
  type AboStrategyFormPayload,
} from "./strategies/abo-strategy-form"

interface CampaignDetailContentProps {
  campaignId: string
}

export function CampaignDetailContent({ campaignId }: CampaignDetailContentProps) {
  const queryClient = useQueryClient()
  const [pendingName, setPendingName] = useState("")
  const [pendingStatus, setPendingStatus] = useState<CampaignStatus>("draft")
  const [pendingVariantId, setPendingVariantId] = useState("")
  const [pendingVariantName, setPendingVariantName] = useState("")
  const [pendingAbo, setPendingAbo] = useState<AboStrategyFormPayload | null>(null)
  const [isAboValid, setIsAboValid] = useState(true)
  const [aboErrors, setAboErrors] = useState<ABODynamicFieldErrors>({})
  const [saveNotice, setSaveNotice] = useState<string | null>(null)
  const [launchDialogOpen, setLaunchDialogOpen] = useState(false)

  const {
    data: campaign,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["campaign", campaignId],
    queryFn: async () => {
      const result = await runServerAction(getCampaignByIdAction(campaignId))
      if (!result) throw new Error("Campaña no encontrada")
      return result
    },
    staleTime: 30 * 1000,
  })

  const { data: strategies = [] } = useQuery({
    queryKey: ["tiktok-strategies"],
    queryFn: () => runServerAction(listTikTokStrategiesAction()),
    staleTime: 60 * 60 * 1000,
  })

  useEffect(() => {
    if (!campaign || campaign.strategy !== "ABO") return
    const config = campaign.config as ABOStrategyConfig
    setPendingName(campaign.name)
    setPendingStatus(campaign.status)
    setPendingAbo({
      dynamic: config.dynamic,
      landingPages: config.landingPages,
      creatives: config.creatives,
    })
    setPendingVariantId(config.dynamic.variantId)
    setPendingVariantName(config.dynamic.variantName)
  }, [campaign])

  const isDirty = useMemo(() => {
    if (!campaign || campaign.strategy !== "ABO" || !pendingAbo) return false

    const generalDirty =
      pendingName.trim() !== campaign.name || pendingStatus !== campaign.status

    const config = campaign.config as ABOStrategyConfig
    const dynamic = config.dynamic

    const strategyDirty =
      pendingVariantId !== dynamic.variantId ||
      pendingVariantName !== dynamic.variantName ||
      pendingAbo.dynamic.budgetPerAdgroup !== dynamic.budgetPerAdgroup ||
      pendingAbo.dynamic.autoCreateAdgroupsFromCreatives !==
        dynamic.autoCreateAdgroupsFromCreatives ||
      pendingAbo.dynamic.landingPageId !== dynamic.landingPageId ||
      pendingAbo.dynamic.landingPageUrl !== dynamic.landingPageUrl ||
      pendingAbo.dynamic.adText !== dynamic.adText ||
      pendingAbo.dynamic.selectedCreativeIds.join(",") !==
        dynamic.selectedCreativeIds.join(",") ||
      pendingAbo.landingPages.map((p) => p.url).join("|") !==
        config.landingPages.map((p) => p.url).join("|")

    return generalDirty || strategyDirty
  }, [campaign, pendingAbo, pendingName, pendingStatus, pendingVariantId, pendingVariantName])

  const handleAboChange = useCallback((payload: AboStrategyFormPayload) => {
    setPendingAbo(payload)
    setSaveNotice(null)
  }, [])

  const handleValidationChange = useCallback(
    (valid: boolean, errors: ABODynamicFieldErrors) => {
      setIsAboValid(valid)
      setAboErrors(errors)
    },
    []
  )

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!campaign) throw new Error("Campaña no encontrada")

      return runServerAction(
        updateCampaignDetailAction({
          campaignId,
          name: pendingName.trim(),
          status: pendingStatus,
          ...(campaign.strategy === "ABO" && pendingAbo
            ? {
                aboDynamic: {
                  ...pendingAbo.dynamic,
                  variantId: pendingVariantId,
                  variantName: pendingVariantName,
                },
                aboLandingPages: pendingAbo.landingPages,
                aboCreatives: pendingAbo.creatives,
              }
            : {}),
        })
      )
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["campaign", campaignId], updated)
      void queryClient.invalidateQueries({ queryKey: ["campaigns"] })
      setSaveNotice("Cambios guardados")
    },
  })

  const strategyMutation = useMutation({
    mutationFn: async (strategy: TikTokStrategyId) =>
      runServerAction(
        updateCampaignStrategyAction({
          campaignId,
          strategy,
        })
      ),
    onSuccess: (updated) => {
      queryClient.setQueryData(["campaign", campaignId], updated)
      void queryClient.invalidateQueries({ queryKey: ["campaigns"] })
      setSaveNotice("Estrategia actualizada")
    },
  })

  const handleLaunchSuccess = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] })
    void queryClient.invalidateQueries({ queryKey: ["campaigns"] })
    setSaveNotice("Campaña publicada en TikTok")
  }, [campaignId, queryClient])

  if (isLoading) {
    return (
      <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full max-w-xl" />
        <Skeleton className="h-64 w-full max-w-2xl" />
      </div>
    )
  }

  if (isError || !campaign) {
    return (
      <div className="flex w-full flex-col gap-4 p-6 lg:p-8">
        <Button variant="ghost" size="sm" className="w-fit" asChild>
          <Link href="/campaigns">
            <RiArrowLeftLine className="size-4" />
            Volver al kanban
          </Link>
        </Button>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error instanceof Error ? error.message : "Campaña no encontrada"}
        </div>
      </div>
    )
  }

  const aboConfig =
    campaign.strategy === "ABO" ? (campaign.config as ABOStrategyConfig) : null

  const canSave =
    isDirty &&
    pendingName.trim().length > 0 &&
    (campaign.strategy !== "ABO" || (pendingAbo !== null && isAboValid)) &&
    !saveMutation.isPending &&
    !strategyMutation.isPending

  const canLaunch =
    !isDirty &&
    campaign.strategy === "ABO" &&
    (campaign.status === "draft" || campaign.status === "ready") &&
    (pendingAbo === null || isAboValid) &&
    !saveMutation.isPending &&
    !strategyMutation.isPending

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
              {pendingName.trim() || campaign.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              Estrategia: {campaign.strategy}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!canLaunch}
              onClick={() => setLaunchDialogOpen(true)}
            >
              <RiRocketLine className="size-4" />
              Lanzar en TikTok
            </Button>
            <Button
              type="button"
              disabled={!canSave}
              onClick={() => saveMutation.mutate()}
            >
              <RiSaveLine className="size-4" />
              Guardar
            </Button>
          </div>
          {isDirty ? (
            <p className="text-muted-foreground text-xs">
              Guarda cambios antes de lanzar
            </p>
          ) : null}
        </div>
      </div>

      <CampaignLaunchDialog
        campaignId={campaignId}
        open={launchDialogOpen}
        onOpenChange={setLaunchDialogOpen}
        onLaunchSuccess={handleLaunchSuccess}
      />

      {saveNotice ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">{saveNotice}</p>
      ) : null}

      {saveMutation.isError ? (
        <p className="text-sm text-destructive">
          {saveMutation.error instanceof Error
            ? saveMutation.error.message
            : "No se pudo guardar"}
        </p>
      ) : null}

      <CampaignGeneralSection
        name={pendingName}
        status={pendingStatus}
        disabled={saveMutation.isPending || strategyMutation.isPending}
        onNameChange={(name) => {
          setPendingName(name)
          setSaveNotice(null)
        }}
        onStatusChange={(status) => {
          setPendingStatus(status)
          setSaveNotice(null)
        }}
      />

      <section className="max-w-2xl space-y-4 rounded-xl border bg-muted/10 p-4">
        <div>
          <h2 className="text-sm font-semibold">Estrategia</h2>
          <p className="text-xs text-muted-foreground">
            Configuración específica según la estrategia seleccionada.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="campaign-strategy" className="text-sm font-medium">
            Tipo de estrategia
          </label>
          <select
            id="campaign-strategy"
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none"
            value={campaign.strategy}
            disabled={strategyMutation.isPending || saveMutation.isPending}
            onChange={(event) => {
              const nextStrategy = event.target.value as TikTokStrategyId
              if (nextStrategy === campaign.strategy) return
              strategyMutation.mutate(nextStrategy)
            }}
          >
            {strategies.map((strategy) => (
              <option key={strategy.id} value={strategy.id}>
                {strategy.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            {strategies.find((entry) => entry.id === campaign.strategy)?.description}
          </p>
        </div>

        {campaign.strategy === "ABO" ? (
          <CampaignVariantSelect
            value={pendingVariantId}
            disabled={saveMutation.isPending || strategyMutation.isPending}
            onChange={(variantId, variantName) => {
              setPendingVariantId(variantId)
              setPendingVariantName(variantName)
              setSaveNotice(null)
            }}
          />
        ) : null}

        {campaign.strategy === "ABO" && aboConfig && pendingAbo ? (
          <>
            <AboStrategyForm
              key={`${campaign.id}-${campaign.updatedAt.toISOString()}`}
              config={aboConfig}
              variantId={pendingVariantId}
              variantName={pendingVariantName}
              disabled={saveMutation.isPending || strategyMutation.isPending}
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
