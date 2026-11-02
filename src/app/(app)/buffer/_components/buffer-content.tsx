"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format, isValid, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { RiCalendarScheduleLine, RiRefreshLine } from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
import { runServerAction } from "@/lib/server-action"
import {
  BUFFER_POST_STATUSES,
  type BufferChannel,
  type BufferPost,
  type BufferPostStatus,
} from "@/lib/services/buffer/buffer"
import { rememberBufferPosts } from "@/lib/services/buffer/match-post"
import type {
  BufferPostInvestment,
  BufferPostVideoAd,
} from "@/lib/services/buffer/post-investment"
import {
  getSavedBufferSnapshotAction,
  refreshBufferSnapshotAction,
} from "../_actions/buffer"

const BUFFER_SNAPSHOT_KEY = ["buffer-snapshot"] as const

const STATUS_LABEL: Record<BufferPostStatus, string> = {
  scheduled: "Programados",
  sent: "Enviados",
  draft: "Borradores",
  error: "Con error",
  needs_approval: "Por aprobar",
  sending: "Enviando",
}

const EMPTY_STATUS_LABEL: Record<BufferPostStatus, string> = {
  scheduled: "programadas",
  sent: "enviadas",
  draft: "en borrador",
  error: "con error",
  needs_approval: "por aprobar",
  sending: "en envío",
}

const SERVICE_LABEL: Record<string, string> = {
  bluesky: "Bluesky",
  facebook: "Facebook",
  googlebusiness: "Google Business",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  mastodon: "Mastodon",
  pinterest: "Pinterest",
  startPage: "Start Page",
  substack: "Substack",
  threads: "Threads",
  tiktok: "TikTok",
  twitter: "X",
  whatsapp: "WhatsApp",
  youtube: "YouTube",
}

function serviceLabel(service: string) {
  return SERVICE_LABEL[service] ?? service
}

function isStatus(value: string): value is BufferPostStatus {
  return (BUFFER_POST_STATUSES as readonly string[]).includes(value)
}

function formatWhen(value: string | null) {
  if (!value) return "Sin fecha"
  const date = parseISO(value)
  if (!isValid(date)) return "Sin fecha"
  return format(date, "d MMM yyyy, HH:mm", { locale: es })
}

function postMoment(post: BufferPost) {
  if (post.status === "sent") return post.sentAt ?? post.createdAt
  return post.dueAt ?? post.createdAt
}

function channelTitle(channel: BufferChannel) {
  return channel.displayName || channel.name
}

function sortPosts(posts: BufferPost[], status: BufferPostStatus) {
  const byDueDate =
    status === "scheduled" || status === "sending" || status === "needs_approval"

  return posts.toSorted((left, right) => {
    const leftTime = Date.parse((byDueDate ? left.dueAt : left.createdAt) ?? "") || 0
    const rightTime = Date.parse((byDueDate ? right.dueAt : right.createdAt) ?? "") || 0
    return byDueDate ? leftTime - rightTime : rightTime - leftTime
  })
}

export function BufferContent() {
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [channelId, setChannelId] = useState<string | null>(null)
  const [channelPicked, setChannelPicked] = useState(false)
  const [status, setStatus] = useState<BufferPostStatus>("sent")
  const organizationIdRef = useRef<string | null>(null)
  const queryClient = useQueryClient()

  const snapshotQuery = useQuery({
    queryKey: BUFFER_SNAPSHOT_KEY,
    queryFn: () => runServerAction(getSavedBufferSnapshotAction()),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  const refreshMutation = useMutation({
    mutationFn: () =>
      runServerAction(refreshBufferSnapshotAction(organizationIdRef.current)),
    onSuccess: (snapshot) => {
      queryClient.setQueryData(BUFFER_SNAPSHOT_KEY, snapshot)
    },
  })

  const snapshot = snapshotQuery.data
  const board = snapshot?.board ?? null
  const investmentByPostId = useMemo(() => {
    const map = new Map<string, BufferPostInvestment>()
    for (const investment of snapshot?.investments ?? []) {
      map.set(investment.postId, investment)
    }
    return map
  }, [snapshot?.investments])
  organizationIdRef.current = organizationId ?? board?.organizations[0]?.id ?? null

  useEffect(() => {
    if (!board) return
    rememberBufferPosts(board.posts)
  }, [board])
  const selectedOrganization =
    board?.organizations.find((item) => item.id === organizationId) ??
    board?.organizations[0]
  const selectedOrganizationId = selectedOrganization?.id ?? null
  const channels = board?.channels ?? []
  const tiktokChannel =
    channels.find((channel) => channel.service.toLowerCase() === "tiktok") ?? null
  const activeChannelId = channelPicked ? channelId : (tiktokChannel?.id ?? null)
  const selectedChannel = channels.find((channel) => channel.id === activeChannelId)
  const visiblePosts = useMemo(
    () =>
      sortPosts(
        (board?.posts ?? []).filter(
          (post) =>
            post.status === status &&
            (activeChannelId === null || post.channelId === activeChannelId)
        ),
        status
      ),
    [activeChannelId, board?.posts, status]
  )

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <RiCalendarScheduleLine className="size-7" />
            Buffer
          </h1>
          <p className="text-muted-foreground text-sm">
            {board?.account.name ? `${board.account.name} · ` : null}
            {selectedOrganization?.name ?? "Canales y cola de publicación"}
            {board?.account.timezone ? ` · ${board.account.timezone}` : null}
          </p>
          <p className="text-muted-foreground text-xs">
            Los datos quedan guardados en el servidor. Buffer solo se consulta al
            pulsar Actualizar.
            {snapshot?.syncedAt
              ? ` Última consulta guardada: ${format(parseISO(snapshot.syncedAt), "d MMM yyyy, HH:mm", { locale: es })}.`
              : null}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={refreshMutation.isPending}
          onClick={() => {
            refreshMutation.mutate()
          }}
        >
          <RiRefreshLine
            className={cn("size-4", refreshMutation.isPending && "animate-spin")}
          />
          Actualizar
        </Button>
      </div>

      {refreshMutation.isError ? (
        <p className="text-destructive text-sm">
          {refreshMutation.error instanceof Error
            ? refreshMutation.error.message
            : "No se pudo actualizar Buffer. Se siguen mostrando los datos guardados."}
        </p>
      ) : null}

      {snapshotQuery.isLoading && !board ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-20" />
          ))}
        </div>
      ) : snapshotQuery.isError && !board ? (
        <p className="text-destructive text-sm">
          {snapshotQuery.error instanceof Error
            ? snapshotQuery.error.message
            : "No se pudieron leer los datos guardados de Buffer."}
        </p>
      ) : board ? (
        <>
          {board.organizations.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {board.organizations.map((organization) => (
                <Button
                  key={organization.id}
                  type="button"
                  size="sm"
                  variant={
                    organization.id === selectedOrganizationId ? "default" : "outline"
                  }
                  onClick={() => {
                    setOrganizationId(organization.id)
                    setChannelPicked(false)
                    setChannelId(null)
                  }}
                >
                  {organization.name}
                </Button>
              ))}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ChannelFilter
              pressed={activeChannelId === null}
              title="Todos los canales"
              subtitle={`${channels.length} conectados`}
              onClick={() => {
                setChannelPicked(true)
                setChannelId(null)
              }}
            />
            {channels.map((channel) => (
              <ChannelFilter
                key={channel.id}
                pressed={channel.id === activeChannelId}
                title={channelTitle(channel)}
                subtitle={channel.descriptor}
                avatar={channel.avatar}
                badges={[
                  serviceLabel(channel.service),
                  channel.isQueuePaused ? "Cola pausada" : null,
                  channel.isDisconnected ? "Desconectado" : null,
                  channel.isLocked ? "Bloqueado" : null,
                ].flatMap((badge) => (badge ? [badge] : []))}
                onClick={() => {
                  setChannelPicked(true)
                  setChannelId(channel.id)
                }}
              />
            ))}
          </div>
        </>
      ) : null}

      <Tabs
        value={status}
        onValueChange={(value) => {
          if (isStatus(value)) setStatus(value)
        }}
      >
        <div className="overflow-x-auto">
          <TabsList>
            {BUFFER_POST_STATUSES.map((item) => (
              <TabsTrigger key={item} value={item}>
                {STATUS_LABEL[item]}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {snapshotQuery.isLoading && !board ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
      ) : !board ? (
        <p className="text-muted-foreground text-sm">
          Todavía no hay datos guardados. Pulsa Actualizar para consultar Buffer
          una vez.
        </p>
      ) : visiblePosts.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No hay publicaciones {EMPTY_STATUS_LABEL[status]}
          {selectedChannel ? ` en ${channelTitle(selectedChannel)}` : ""} en la
          última consulta.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visiblePosts.map((post) => (
            <PostRow
              key={post.id}
              post={post}
              channelName={
                channels.find((channel) => channel.id === post.channelId)?.name
              }
              catalog={snapshot?.catalog ?? []}
              investment={
                post.channelService.toLowerCase() === "tiktok"
                  ? investmentByPostId.get(post.id) ?? null
                  : null
              }
              investmentLoading={
                post.channelService.toLowerCase() === "tiktok" &&
                refreshMutation.isPending &&
                !investmentByPostId.has(post.id)
              }
            />
          ))}
        </ul>
      )}

      {board?.hasMorePosts ? (
        <p className="text-muted-foreground text-xs">
          Se muestran las 60 publicaciones más recientes. Actualizar vuelve a
          pedir solo ese bloque.
        </p>
      ) : null}
    </div>
  )
}

function ChannelFilter({
  pressed,
  title,
  subtitle,
  avatar,
  badges = [],
  onClick,
}: {
  pressed: boolean
  title: string
  subtitle: string
  avatar?: string
  badges?: string[]
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-xl bg-card px-3 py-3 text-left ring-1 ring-foreground/10",
        pressed && "ring-2 ring-ring"
      )}
    >
      {avatar ? (
        <img
          src={avatar}
          alt=""
          className="size-10 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span className="bg-muted size-10 shrink-0 rounded-full" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{title}</span>
        <span className="text-muted-foreground block truncate text-xs">{subtitle}</span>
        {badges.length > 0 ? (
          <span className="mt-1 flex flex-wrap gap-1">
            {badges.map((badge) => (
              <Badge key={badge} variant="secondary">
                {badge}
              </Badge>
            ))}
          </span>
        ) : null}
      </span>
    </button>
  )
}

function formatCop(value: number) {
  return `${formatCurrency(value, "COP")} COP`
}

type VideoOption = { value: string; label: string }

function adStatusLabel(status: string | null) {
  const value = (status ?? "").toUpperCase()
  if (value === "ENABLE" || value === "ACTIVE") return "Activo"
  if (value === "DISABLE" || value === "PAUSED") return "Pausado"
  if (value === "DELETE" || value === "DELETED") return "Eliminado"
  return status?.trim() || "Sin estado"
}

function campaignOptions(ads: BufferPostVideoAd[]): VideoOption[] {
  const names = new Map<string, string>()
  for (const ad of ads) {
    if (!names.has(ad.campaignId)) names.set(ad.campaignId, ad.campaignName)
  }
  return [...names.entries()].map(([value, label]) => ({ value, label }))
}

function adgroupOptions(ads: BufferPostVideoAd[], campaignIds: string[]): VideoOption[] {
  const names = new Map<string, { label: string; campaignName: string }>()
  for (const ad of ads) {
    if (!campaignIds.includes(ad.campaignId) || names.has(ad.adgroupId)) continue
    names.set(ad.adgroupId, { label: ad.adgroupName, campaignName: ad.campaignName })
  }
  const labelCounts = new Map<string, number>()
  for (const item of names.values()) {
    labelCounts.set(item.label, (labelCounts.get(item.label) ?? 0) + 1)
  }
  return [...names.entries()].map(([value, item]) => ({
    value,
    label:
      (labelCounts.get(item.label) ?? 0) > 1
        ? `${item.campaignName} · ${item.label}`
        : item.label,
  }))
}

function adCpa(ad: BufferPostVideoAd) {
  if (ad.spend == null || ad.purchases == null || ad.purchases <= 0) return null
  return ad.spend / ad.purchases
}

function selectionTotals(ads: BufferPostVideoAd[]) {
  let spend = 0
  let purchases = 0
  let hasMetrics = false
  for (const ad of ads) {
    if (ad.spend == null || ad.purchases == null) continue
    hasMetrics = true
    spend += ad.spend
    purchases += ad.purchases
  }
  return {
    hasMetrics,
    spend,
    purchases,
    cpa: purchases > 0 ? spend / purchases : null,
  }
}

function sameOption(left: VideoOption, right: VideoOption) {
  return left.value === right.value
}

function MultiPicker({
  label,
  placeholder,
  options,
  value,
  onValueChange,
}: {
  label: string
  placeholder: string
  options: VideoOption[]
  value: string[]
  onValueChange: (value: string[]) => void
}) {
  const anchor = useComboboxAnchor()
  const selected = options.filter((option) => value.includes(option.value))

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs">{label}</span>
      <Combobox
        items={options}
        multiple
        autoHighlight
        value={selected}
        onValueChange={(next) => onValueChange(next.map((item) => item.value))}
        isItemEqualToValue={sameOption}
        itemToStringLabel={(item) => item.label}
        itemToStringValue={(item) => item.value}
      >
        <ComboboxChips ref={anchor} className="w-full">
          <ComboboxValue>
            {(values: VideoOption[]) => (
              <>
                {values.map((item) => (
                  <ComboboxChip key={item.value}>{item.label}</ComboboxChip>
                ))}
                <ComboboxChipsInput
                  placeholder={values.length === 0 ? placeholder : ""}
                />
              </>
            )}
          </ComboboxValue>
        </ComboboxChips>
        <ComboboxContent anchor={anchor}>
          <ComboboxEmpty>Sin resultados.</ComboboxEmpty>
          <ComboboxList>
            <ComboboxGroup>
              <ComboboxCollection>
                {(item: VideoOption) => (
                  <ComboboxItem key={item.value} value={item}>
                    {item.label}
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  )
}

function PostVideoAds({
  ads,
  initialCampaignId,
  initialAdgroupId,
}: {
  ads: BufferPostVideoAd[]
  initialCampaignId?: string
  initialAdgroupId?: string
}) {
  const campaigns = useMemo(() => campaignOptions(ads), [ads])
  const [campaignIds, setCampaignIds] = useState<string[]>(() =>
    initialCampaignId ? [initialCampaignId] : []
  )
  const [adgroupIds, setAdgroupIds] = useState<string[]>(() =>
    initialAdgroupId ? [initialAdgroupId] : []
  )
  const selectedCampaignIds = campaignIds.filter((id) =>
    campaigns.some((campaign) => campaign.value === id)
  )
  const adgroups = useMemo(
    () => adgroupOptions(ads, selectedCampaignIds),
    [ads, selectedCampaignIds]
  )
  const selectedAdgroupIds = adgroupIds.filter((id) =>
    adgroups.some((group) => group.value === id)
  )
  const visibleAds = ads.filter(
    (ad) =>
      selectedCampaignIds.includes(ad.campaignId) &&
      selectedAdgroupIds.includes(ad.adgroupId)
  )
  const totals = selectionTotals(visibleAds)

  if (campaigns.length === 0) return null

  return (
    <div className="flex flex-col gap-2 pt-1">
      <div className="grid gap-2 sm:grid-cols-2">
        <MultiPicker
          label="Campañas"
          placeholder="Agregar campaña"
          options={campaigns}
          value={selectedCampaignIds}
          onValueChange={(next) => {
            setCampaignIds(next)
            setAdgroupIds((current) =>
              current.filter((id) =>
                ads.some((ad) => next.includes(ad.campaignId) && ad.adgroupId === id)
              )
            )
          }}
        />
        <MultiPicker
          label="Conjuntos"
          placeholder="Agregar conjunto"
          options={adgroups}
          value={selectedAdgroupIds}
          onValueChange={setAdgroupIds}
        />
      </div>
      {visibleAds.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          Agrega una campaña y un conjunto para ver sus anuncios.
        </p>
      ) : (
        <>
          {totals.hasMetrics ? (
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              <span>Gasto {formatCop(totals.spend)}</span>
              <span>Compras {totals.purchases.toLocaleString("es-CO")}</span>
              <span>CPA {totals.cpa == null ? "—" : formatCop(totals.cpa)}</span>
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">
              Pulsa Actualizar para ver compras y CPA.
            </p>
          )}
          <ul className="flex flex-col gap-1">
            {visibleAds.map((ad) => {
              const status = adStatusLabel(ad.operationStatus)
              const cpa = adCpa(ad)
              const title = [
                selectedCampaignIds.length > 1 ? ad.campaignName : null,
                selectedAdgroupIds.length > 1 && ad.adgroupName !== ad.adName
                  ? ad.adgroupName
                  : null,
                ad.adName,
              ]
                .filter((part) => part)
                .join(" · ")
              return (
                <li
                  key={ad.adId}
                  className="flex min-w-0 flex-col gap-1 rounded-md bg-muted/40 px-2 py-1.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="truncate text-xs" title={title}>
                    {title}
                  </span>
                  <span className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {totals.hasMetrics ? (
                      <>
                        <span>
                          Compras{" "}
                          {ad.purchases == null
                            ? "—"
                            : ad.purchases.toLocaleString("es-CO")}
                        </span>
                        <span>CPA {cpa == null ? "—" : formatCop(cpa)}</span>
                      </>
                    ) : null}
                    <Badge
                      variant={
                        status === "Activo"
                          ? "secondary"
                          : status === "Eliminado"
                            ? "destructive"
                            : "outline"
                      }
                    >
                      {status}
                    </Badge>
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}

function PostRow({
  post,
  channelName,
  catalog,
  investment,
  investmentLoading,
}: {
  post: BufferPost
  channelName?: string
  catalog: BufferPostVideoAd[]
  investment: BufferPostInvestment | null
  investmentLoading: boolean
}) {
  const thumbnail = post.assets.find((asset) => asset.thumbnail)?.thumbnail
  const pickerAds = catalog.length > 0 ? catalog : investment?.videoAds ?? null
  const initialAd = investment?.videoAds?.[0]

  return (
    <li className="flex items-start gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
      {thumbnail ? (
        <img
          src={thumbnail}
          alt=""
          className="size-16 shrink-0 rounded-lg object-cover"
        />
      ) : null}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="line-clamp-3 text-sm whitespace-pre-wrap">{post.text || "Sin texto"}</p>
        {post.channelService.toLowerCase() === "tiktok" ? (
          <>
            {investment ? (
              <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                <span>Gasto {formatCop(investment.spend)}</span>
                <span>Compras {investment.purchases.toLocaleString("es-CO")}</span>
                <span>
                  CPA {investment.cpa == null ? "—" : formatCop(investment.cpa)}
                </span>
                <span>
                  {investment.campaignNames.length === 1
                    ? "1 campaña"
                    : `${investment.campaignNames.length} campañas`}
                </span>
              </p>
            ) : null}
            {pickerAds != null ? (
              <PostVideoAds
                ads={pickerAds}
                initialCampaignId={initialAd?.campaignId}
                initialAdgroupId={initialAd?.adgroupId}
              />
            ) : investmentLoading ? (
              <p className="text-muted-foreground text-xs">Cargando TikTok Ads…</p>
            ) : investment ? (
              <p className="text-muted-foreground text-xs">
                Pulsa Actualizar para elegir campaña y conjunto.
              </p>
            ) : null}
          </>
        ) : null}
        <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span>{serviceLabel(post.channelService)}</span>
          {channelName ? <span>{channelName}</span> : null}
          <span>{formatWhen(postMoment(post))}</span>
          <Badge variant={post.status === "error" ? "destructive" : "outline"}>
            {STATUS_LABEL[post.status]}
          </Badge>
        </p>
        {post.errorMessage ? (
          <p className="text-destructive text-xs">{post.errorMessage}</p>
        ) : null}
        {post.externalLink ? (
          <a
            href={post.externalLink}
            target="_blank"
            rel="noreferrer"
            className="text-xs underline-offset-4 hover:underline"
          >
            Ver publicación
          </a>
        ) : null}
      </div>
    </li>
  )
}
