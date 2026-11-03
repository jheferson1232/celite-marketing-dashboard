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
import {
  defaultSelectionForVideoAds,
  filterSelectionToVideoAds,
  readBufferAdSelectionForPost,
  rememberBufferPostCatalog,
  hasExplicitBufferAdSelectionForPost,
  videoIdFromBufferExternalLink,
} from "@/lib/services/buffer/buffer-ad-selection"
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

function formatWhen(value: string | null, pattern = "d MMM yyyy, HH:mm") {
  if (!value) return "Sin fecha"
  const date = parseISO(value)
  if (!isValid(date)) return "Sin fecha"
  return format(date, pattern, { locale: es })
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
    rememberBufferPostCatalog(board.posts)
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
        <ul className="flex flex-col gap-2">
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

type VideoOption = { value: string; label: string }

function adStatusLabel(status: string | null) {
  const value = (status ?? "").toUpperCase()
  if (value === "ENABLE" || value === "ACTIVE") return "Activo"
  if (value === "DISABLE" || value === "PAUSED") return "Pausado"
  if (value === "DELETE" || value === "DELETED") return "Eliminado"
  return status?.trim() || "Sin estado"
}

function shortMoney(value: number) {
  return formatCurrency(value, "COP")
}

function shortMetrics(spend: number, purchases: number, cpa: number | null) {
  return `${shortMoney(spend)} · ${purchases.toLocaleString("es-CO")} compras · CPA ${
    cpa == null ? "—" : shortMoney(cpa)
  }`
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
    <div className="flex min-w-0 items-center gap-1">
      <span className="text-muted-foreground w-14 shrink-0 text-[11px]">{label}</span>
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
        <ComboboxChips ref={anchor} className="min-h-7 w-full flex-1 py-0.5 text-xs shadow-none">
          <ComboboxValue>
            {(values: VideoOption[]) => (
              <>
                {values.map((item) => (
                  <ComboboxChip key={item.value} className="h-5 max-w-40">
                    <span className="truncate">{item.label}</span>
                  </ComboboxChip>
                ))}
                <ComboboxChipsInput
                  className="min-w-8 text-xs"
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

function mergeVideoAdsWithCatalog(
  videoAds: BufferPostVideoAd[],
  catalog: BufferPostVideoAd[]
): BufferPostVideoAd[] {
  if (catalog.length === 0) return videoAds
  const byAdId = new Map(catalog.map((ad) => [ad.adId, ad]))
  return videoAds.map((ad) => {
    const metrics = byAdId.get(ad.adId)
    if (!metrics) return ad
    return {
      ...ad,
      spend: metrics.spend,
      purchases: metrics.purchases,
      operationStatus: metrics.operationStatus ?? ad.operationStatus,
    }
  })
}

/** Solo ads que publican el mismo video que el post (no el catálogo entero). */
function postPickerAds(
  catalog: BufferPostVideoAd[],
  investment: BufferPostInvestment | null
): BufferPostVideoAd[] | null {
  const videoAds = investment?.videoAds
  if (!videoAds?.length) return null
  return mergeVideoAdsWithCatalog(videoAds, catalog)
}

function resolvePickerSelection(input: {
  bufferPostId: string
  bufferVideoId: string | null
  ads: BufferPostVideoAd[]
}): { campaignIds: string[]; adgroupIds: string[]; fromTikTokDashboard: boolean } {
  const saved = readBufferAdSelectionForPost(
    input.bufferPostId,
    input.bufferVideoId
  )
  if (saved && input.ads.length > 0) {
    const filtered = filterSelectionToVideoAds(saved, input.ads)
    if (filtered.campaignIds.length > 0 || filtered.adgroupIds.length > 0) {
      const explicit = hasExplicitBufferAdSelectionForPost(input.bufferPostId)
      const legacyOnly =
        !explicit &&
        saved.videoId === input.bufferVideoId &&
        Boolean(input.bufferVideoId)
      return {
        ...filtered,
        fromTikTokDashboard: explicit || legacyOnly,
      }
    }
  }
  return {
    ...defaultSelectionForVideoAds(input.ads),
    fromTikTokDashboard: false,
  }
}

function PostVideoAds({
  ads,
  bufferPostId,
  bufferVideoId,
}: {
  ads: BufferPostVideoAd[]
  bufferPostId: string
  bufferVideoId: string | null
}) {
  const campaigns = useMemo(() => campaignOptions(ads), [ads])
  const [campaignIds, setCampaignIds] = useState<string[]>([])
  const [adgroupIds, setAdgroupIds] = useState<string[]>([])
  const [fromTikTokDashboard, setFromTikTokDashboard] = useState(false)

  useEffect(() => {
    const next = resolvePickerSelection({
      bufferPostId,
      bufferVideoId,
      ads,
    })
    setCampaignIds(next.campaignIds)
    setAdgroupIds(next.adgroupIds)
    setFromTikTokDashboard(next.fromTikTokDashboard)
  }, [bufferPostId, bufferVideoId, ads])
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
  const singleAd = visibleAds.length === 1 ? visibleAds[0] : null

  if (campaigns.length === 0) return null

  return (
    <div className="flex flex-col gap-1">
      <p className="text-muted-foreground text-[10px] leading-snug">
        {fromTikTokDashboard
          ? "Selección desde TikTok · campañas y conjuntos que anuncian este video."
          : "Campañas y conjuntos que anuncian este video."}
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5">
          <MultiPicker
            label="Campaña"
            placeholder="+"
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
            label="Conjunto"
            placeholder="+"
            options={adgroups}
            value={selectedAdgroupIds}
            onValueChange={setAdgroupIds}
          />
        </div>
        {visibleAds.length > 0 && totals.hasMetrics ? (
          <p className="text-xs whitespace-nowrap">
            {shortMetrics(totals.spend, totals.purchases, totals.cpa)}
            {singleAd ? ` · ${adStatusLabel(singleAd.operationStatus)}` : ""}
          </p>
        ) : null}
      </div>
      {visibleAds.length === 0 ? (
        <p className="text-muted-foreground text-[11px]">Elige campaña y conjunto.</p>
      ) : totals.hasMetrics ? null : (
        <p className="text-muted-foreground text-[11px]">Pulsa Actualizar para ver el CPA.</p>
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
  const pickerAds = postPickerAds(catalog, investment)
  const bufferVideoId = videoIdFromBufferExternalLink(post.externalLink)

  return (
    <li className="flex items-start gap-2 rounded-lg bg-card px-2.5 py-2 ring-1 ring-foreground/10">
      {thumbnail ? (
        <img
          src={thumbnail}
          alt=""
          className="size-10 shrink-0 rounded-md object-cover"
        />
      ) : null}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="line-clamp-1 text-sm">{post.text || "Sin texto"}</p>
        {post.channelService.toLowerCase() === "tiktok" ? (
          <>
            {pickerAds != null ? (
              <PostVideoAds
                ads={pickerAds}
                bufferPostId={post.id}
                bufferVideoId={bufferVideoId}
              />
            ) : investmentLoading ? (
              <p className="text-muted-foreground text-xs">Cargando TikTok Ads…</p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Sin anuncios TikTok vinculados a este video. Usá «Pasar a Buffer» en
                el creativo del dashboard TikTok o pulsa Actualizar.
              </p>
            )}
          </>
        ) : null}
        <p className="text-muted-foreground flex min-w-0 items-center gap-x-1.5 truncate text-[11px]">
          <span className="shrink-0">{serviceLabel(post.channelService)}</span>
          {channelName ? <span className="truncate">{channelName}</span> : null}
          <span className="shrink-0">{formatWhen(postMoment(post), "d MMM HH:mm")}</span>
          {post.status === "error" ? (
            <Badge variant="destructive">{STATUS_LABEL[post.status]}</Badge>
          ) : null}
          {post.externalLink ? (
            <a
              href={post.externalLink}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 underline-offset-2 hover:underline"
            >
              Ver
            </a>
          ) : null}
        </p>
        {post.errorMessage ? (
          <p className="text-destructive truncate text-[11px]">{post.errorMessage}</p>
        ) : null}
      </div>
    </li>
  )
}
