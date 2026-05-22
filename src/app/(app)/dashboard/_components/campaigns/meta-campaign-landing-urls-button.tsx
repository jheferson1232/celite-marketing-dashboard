"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { RiExternalLinkLine, RiLinkM, RiRefreshLine } from "@remixicon/react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { formatLandingPagePath } from "@/lib/format"
import { runServerAction } from "@/lib/server-action"
import { cn } from "@/lib/utils"
import { isMetaRateLimitError } from "@/lib/services/meta/meta-errors"
import { getMetaCampaignLandingUrlsAction } from "../../_actions/campaign-landing-urls"

function formatLandingDisplay(url: string): { host: string; path: string } {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`)
    return {
      host: parsed.hostname,
      path: formatLandingPagePath(url) || parsed.pathname || "/",
    }
  } catch {
    return { host: "", path: formatLandingPagePath(url) || url }
  }
}

interface MetaCampaignLandingUrlsButtonProps {
  urls: string[]
  campaignId?: string
  campaignName?: string
  /** Mientras el mapa global de URLs carga, no disparar fetch por campaña. */
  globalUrlsLoading?: boolean
}

export function MetaCampaignLandingUrlsButton({
  urls: urlsFromList = [],
  campaignId,
  campaignName,
  globalUrlsLoading = false,
}: MetaCampaignLandingUrlsButtonProps) {
  const [open, setOpen] = React.useState(false)
  const needsFetch =
    urlsFromList.length === 0 && Boolean(campaignId) && !globalUrlsLoading

  const { data: fetchedUrls, isLoading, isError, error, refetch, isFetching } =
    useQuery({
      queryKey: ["meta-campaign-landing-urls", campaignId],
      queryFn: () =>
        runServerAction(getMetaCampaignLandingUrlsAction(campaignId!)),
      enabled: open && needsFetch,
      staleTime: 30 * 60 * 1000,
      retry: false,
    })

  const list =
    urlsFromList.length > 0 ? urlsFromList : (fetchedUrls ?? [])
  const count = list.length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon-sm"
          className="relative gap-0"
          aria-label={
            count > 0
              ? `Ver ${count} link${count === 1 ? "" : "s"} de destino`
              : "Sin links de destino"
          }
          title={
            count > 0
              ? `${count} link${count === 1 ? "" : "s"} único${count === 1 ? "" : "s"}`
              : "Sin links configurados"
          }
        >
          <RiLinkM data-icon="inline-start" />
          {count > 0 ? (
            <span
              className={cn(
                "absolute -top-1.5 -right-1.5 flex min-w-4 h-4 items-center justify-center",
                "rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
              )}
            >
              {count}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(22rem,calc(100vw-2rem))] p-0"
        align="end"
        side="bottom"
      >
        <div className="border-b px-3 py-2">
          <p className="text-sm font-medium">Links de destino</p>
          {campaignName ? (
            <p className="truncate text-xs text-muted-foreground">
              {campaignName}
            </p>
          ) : null}
        </div>
        {globalUrlsLoading ? (
          <p className="px-3 py-3 text-sm text-muted-foreground">
            Cargando URLs de todas las campañas…
          </p>
        ) : needsFetch && isLoading ? (
          <p className="px-3 py-3 text-sm text-muted-foreground">
            Consultando anuncios de esta campaña…
          </p>
        ) : needsFetch && isError ? (
          <div className="flex items-start justify-between gap-2 px-3 py-3">
            <p className="text-sm text-destructive">
              {error && isMetaRateLimitError(error)
                ? "Límite de Meta. Espera 1–2 min y pulsa reintentar."
                : (error?.message ?? "No se pudieron cargar los links.")}
            </p>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Reintentar links de destino"
            >
              <RiRefreshLine data-icon="inline-start" />
            </Button>
          </div>
        ) : count === 0 ? (
          <p className="px-3 py-3 text-sm text-muted-foreground">
            No hay URLs en los anuncios de esta campaña.
          </p>
        ) : (
          <ul className="max-h-56 overflow-y-auto py-1">
            {list.map((url) => {
              const { host, path } = formatLandingDisplay(url)
              return (
                <li key={url}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2 px-3 py-2 text-sm hover:bg-muted/80"
                  >
                    <RiExternalLinkLine className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      {host ? (
                        <span className="block truncate font-medium">
                          {host}
                        </span>
                      ) : null}
                      <span className="block truncate text-xs text-muted-foreground">
                        {path}
                      </span>
                    </span>
                  </a>
                </li>
              )
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
