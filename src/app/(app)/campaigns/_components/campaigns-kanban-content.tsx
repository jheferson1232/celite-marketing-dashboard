"use client"

import { useMemo, useState } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Skeleton } from "@/components/ui/skeleton"
import { runServerAction } from "@/lib/server-action"
import {
  CAMPAIGN_KANBAN_STATUS_VALUES,
  CAMPAIGN_OUTCOME_CPA_THRESHOLD,
  CAMPAIGN_OUTCOME_MIN_SPEND_PEN,
  isCampaignKanbanStatus,
  isCampaignVisibleOnKanban,
  resolveCampaignKanbanColumn,
  type CampaignKanbanStatus,
} from "@/lib/campaigns/status"
import type { CampaignKanbanRecord } from "@/lib/services/campaign-kanban-outcomes"
import { KANBAN_OUTCOMES_QUERY_KEY } from "@/lib/services/campaign-kanban-outcome.shared"
import {
  listCampaignsForKanbanAction,
  updateCampaignStatusAction,
} from "../_actions/campaigns"
import { CampaignCreateButton } from "./campaign-create-dialog"
import { CampaignKanbanCardView } from "./campaigns-kanban-card"
import {
  CAMPAIGN_KANBAN_COLUMN_SKELETON_CLASS,
  CampaignsKanbanColumn,
} from "./campaigns-kanban-column"

function groupCampaignsByKanbanColumn(campaigns: CampaignKanbanRecord[]) {
  const grouped = Object.fromEntries(
    CAMPAIGN_KANBAN_STATUS_VALUES.map((status) => [
      status,
      [] as CampaignKanbanRecord[],
    ])
  ) as Record<CampaignKanbanStatus, CampaignKanbanRecord[]>

  for (const campaign of campaigns) {
    if (!isCampaignVisibleOnKanban(campaign.status)) continue
    grouped[resolveCampaignKanbanColumn(campaign)].push(campaign)
  }

  return grouped
}

function resolveDropColumn(
  over: DragEndEvent["over"],
  campaigns: CampaignKanbanRecord[]
): CampaignKanbanStatus | null {
  if (!over) return null

  const overId = String(over.id)
  if (isCampaignKanbanStatus(overId)) return overId

  const targetCampaign = campaigns.find((campaign) => campaign.id === overId)
  if (targetCampaign) {
    return resolveCampaignKanbanColumn(targetCampaign)
  }

  return null
}

export function CampaignsKanbanContent() {
  const queryClient = useQueryClient()
  const [activeCampaign, setActiveCampaign] =
    useState<CampaignKanbanRecord | null>(null)
  const [overColumn, setOverColumn] = useState<CampaignKanbanStatus | null>(
    null
  )

  const {
    data: campaigns = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["campaigns-kanban"],
    queryFn: () => runServerAction(listCampaignsForKanbanAction()),
    staleTime: 60 * 1000,
  })

  const campaignsByStatus = useMemo(
    () => groupCampaignsByKanbanColumn(campaigns),
    [campaigns]
  )

  const statusMutation = useMutation({
    mutationFn: (input: {
      campaignId: string
      status: CampaignKanbanStatus
    }) => runServerAction(updateCampaignStatusAction(input)),
    onMutate: async ({ campaignId, status }) => {
      await queryClient.cancelQueries({ queryKey: ["campaigns-kanban"] })
      const previous =
        queryClient.getQueryData<CampaignKanbanRecord[]>(["campaigns-kanban"])

      queryClient.setQueryData<CampaignKanbanRecord[]>(
        ["campaigns-kanban"],
        (current = []) =>
          current.map((campaign) =>
            campaign.id === campaignId ? { ...campaign, status } : campaign
          )
      )

      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["campaigns-kanban"], context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["campaigns-kanban"] })
      void queryClient.invalidateQueries({ queryKey: ["campaigns"] })
      void queryClient.invalidateQueries({ queryKey: KANBAN_OUTCOMES_QUERY_KEY })
    },
  })

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  function handleDragStart(event: DragStartEvent) {
    const campaign = event.active.data.current?.campaign as
      | CampaignKanbanRecord
      | undefined
    setActiveCampaign(campaign ?? null)
  }

  function handleDragOver(event: DragOverEvent) {
    setOverColumn(resolveDropColumn(event.over, campaigns))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCampaign(null)
    setOverColumn(null)

    const campaign = event.active.data.current?.campaign as
      | CampaignKanbanRecord
      | undefined
    const targetColumn = resolveDropColumn(event.over, campaigns)

    if (!campaign || !targetColumn) return

    const currentColumn = resolveCampaignKanbanColumn(campaign)
    if (targetColumn === currentColumn) return

    statusMutation.mutate({ campaignId: campaign.id, status: targetColumn })
  }

  function handleDragCancel() {
    setActiveCampaign(null)
    setOverColumn(null)
  }

  return (
    <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Arrastra campañas entre columnas. Las de{" "}
          <strong>En curso</strong> pasan solas a Ganadores/Perdedores cuando el
          gasto total en TikTok supera S/ {CAMPAIGN_OUTCOME_MIN_SPEND_PEN}: CPA
          &lt; {CAMPAIGN_OUTCOME_CPA_THRESHOLD} → Ganadores, CPA &gt;{" "}
          {CAMPAIGN_OUTCOME_CPA_THRESHOLD} → Perdedores (gasto y ventas
          acumuladas, no solo hoy).
        </p>
        <CampaignCreateButton className="shrink-0" />
      </div>

      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {CAMPAIGN_KANBAN_STATUS_VALUES.map((status) => (
            <Skeleton
              key={status}
              className={CAMPAIGN_KANBAN_COLUMN_SKELETON_CLASS}
            />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error instanceof Error
            ? error.message
            : "Error al cargar campañas"}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="flex gap-4 overflow-x-auto pb-2">
            {CAMPAIGN_KANBAN_STATUS_VALUES.map((status) => (
              <CampaignsKanbanColumn
                key={status}
                status={status}
                campaigns={campaignsByStatus[status]}
                activeCampaignId={activeCampaign?.id ?? null}
                isOver={overColumn === status}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeCampaign ? (
              <CampaignKanbanCardView
                campaign={activeCampaign}
                isDragging
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}
