"use client"

import { useState } from "react"
import {
  RiFacebookCircleFill,
  RiLink,
  RiTiktokFill,
} from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import type { ProductPlatform, ProductRecord } from "@/lib/services/product"
import { useProductoCampaignLinks } from "../../_lib/use-producto-campaign-links"

interface ProductoCampanasSectionProps {
  product: ProductRecord
  enabled?: boolean
  showHeader?: boolean
}

function PlatformIcon({ platform }: { platform: string }) {
  if (platform === "meta") {
    return (
      <RiFacebookCircleFill
        className="size-3.5 shrink-0 text-blue-600"
        aria-label="Meta"
      />
    )
  }
  return (
    <RiTiktokFill className="size-3.5 shrink-0" aria-label="TikTok" />
  )
}

function CampaignLinkSelect({
  platform,
  label,
  campaigns,
  disabled,
  onLink,
}: {
  platform: ProductPlatform
  label: string
  campaigns: Array<{ id: string; name: string }>
  disabled: boolean
  onLink: (input: {
    campaignId: string
    campaignName: string
    platform: ProductPlatform
  }) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium">{label}</p>
      {campaigns.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          No hay más campañas disponibles o aún no se cargaron.
        </p>
      ) : (
        <select
          className={cn(
            "border-input bg-background flex h-8 w-full rounded-md border px-2 text-xs shadow-xs",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
          defaultValue=""
          disabled={disabled}
          onChange={(e) => {
            const campaignId = e.target.value
            if (!campaignId) return
            const campaign = campaigns.find((c) => c.id === campaignId)
            if (!campaign) return
            onLink({
              campaignId: campaign.id,
              campaignName: campaign.name,
              platform,
            })
            e.target.value = ""
          }}
        >
          <option value="">Seleccionar campaña…</option>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

export function ProductoCampanasSection({
  product,
  enabled = true,
  showHeader = true,
}: ProductoCampanasSectionProps) {
  const [linkTab, setLinkTab] = useState<ProductPlatform>("tiktok")
  const {
    availableTikTokCampaigns,
    availableMetaCampaigns,
    linkCampaign,
    unlinkCampaign,
    isLinking,
    isUnlinking,
  } = useProductoCampaignLinks({ product, enabled })

  return (
    <section className="min-w-0 space-y-3">
      {showHeader ? (
        <header>
          <h2 className="text-sm font-semibold tracking-tight">Campañas</h2>
          <p className="text-xs text-muted-foreground">
            Vincula o quita campañas de TikTok o Meta asociadas a este producto.
          </p>
        </header>
      ) : null}

      <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
        <Tabs
          value={linkTab}
          onValueChange={(v) => setLinkTab(v as ProductPlatform)}
        >
          <TabsList className="h-8 w-full">
            <TabsTrigger value="tiktok" className="flex-1 gap-1.5 text-xs">
              <RiTiktokFill className="size-3.5" />
              TikTok
            </TabsTrigger>
            <TabsTrigger value="meta" className="flex-1 gap-1.5 text-xs">
              <RiFacebookCircleFill className="size-3.5 text-blue-600" />
              Meta
            </TabsTrigger>
          </TabsList>
          <TabsContent value="tiktok" className="mt-3">
            <CampaignLinkSelect
              platform="tiktok"
              label="Vincular campaña TikTok"
              campaigns={availableTikTokCampaigns}
              disabled={isLinking}
              onLink={linkCampaign}
            />
          </TabsContent>
          <TabsContent value="meta" className="mt-3">
            <CampaignLinkSelect
              platform="meta"
              label="Vincular campaña Meta"
              campaigns={availableMetaCampaigns}
              disabled={isLinking}
              onLink={linkCampaign}
            />
          </TabsContent>
        </Tabs>

        {product.campaigns.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Vincula campañas para ver historial y métricas.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {product.campaigns.map((link) => (
              <li
                key={link.id}
                className="flex items-center justify-between gap-2 rounded-md border bg-background px-2.5 py-2"
              >
                <div className="flex min-w-0 flex-1 items-start gap-2">
                  <PlatformIcon platform={link.platform} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">
                      {link.campaignName ?? link.campaignId}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      ID {link.campaignId}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive h-7 shrink-0 px-2 text-xs"
                  onClick={() =>
                    unlinkCampaign({
                      campaignId: link.campaignId,
                      platform: link.platform as ProductPlatform,
                    })
                  }
                  disabled={isUnlinking}
                >
                  <RiLink className="size-3.5" />
                  Quitar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
