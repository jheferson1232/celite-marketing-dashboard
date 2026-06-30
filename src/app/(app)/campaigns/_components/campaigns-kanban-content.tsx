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
  getCampaignKanbanColumn,
  isCampaignKanbanStatus,
  isCampaignVisibleOnKanban,
  type CampaignKanbanStatus,
} from "@/lib/campaigns/status"
import type { CampaignRecord } from "@/lib/services/campaign"
import { listCampaignsAction, updateCampaignStatusAction } from "../_actions/campaigns"
import { CampaignCreateButton } from "./campaign-create-dialog"
import { CampaignKanbanCardView, CampaignsKanbanCard } from "./campaigns-kanban-card"
import {
  CAMPAIGN_KANBAN_COLUMN_SKELETON_CLASS,
  CampaignsKanbanColumn,
} from "./campaigns-kanban-column"

function groupCampaignsByKanbanColumn(campaigns: CampaignRecord[]) {
  const grouped = Object.fromEntries(
    CAMPAIGN_KANBAN_STATUS_VALUES.map((status) => [status, [] as CampaignRecord[]])
  ) as Record<CampaignKanbanStatus, CampaignRecord[]>

  for (const campaign of campaigns) {
    if (!isCampaignVisibleOnKanban(campaign.status)) continue
    grouped[getCampaignKanbanColumn(campaign.status)].push(campaign)
  }

  return grouped
}

function resolveDropColumn(
  over: DragEndEvent["over"],
  campaigns: CampaignRecord[]
): CampaignKanbanStatus | null {
  if (!over) return null

  const overId = String(over.id)
  if (isCampaignKanbanStatus(overId)) return overId

  const targetCampaign = campaigns.find((campaign) => campaign.id === overId)
  if (targetCampaign) {
    return getCampaignKanbanColumn(targetCampaign.status)
  }

  return null
}

export function CampaignsKanbanContent() {
  const queryClient = useQueryClient()
  const [activeCampaign, setActiveCampaign] = useState<CampaignRecord | null>(null)
  const [overColumn, setOverColumn] = useState<CampaignKanbanStatus | null>(null)

  const { data: campaigns = [], isLoading, isError, error } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => runServerAction(listCampaignsAction()),
    staleTime: 30 * 1000,
  })

  const campaignsByStatus = useMemo(
    () => groupCampaignsByKanbanColumn(campaigns),
    [campaigns]
  )

  const statusMutation = useMutation({
    mutationFn: (input: { campaignId: string; status: CampaignKanbanStatus }) =>
      runServerAction(updateCampaignStatusAction(input)),
    onMutate: async ({ campaignId, status }) => {
      await queryClient.cancelQueries({ queryKey: ["campaigns"] })
      const previous = queryClient.getQueryData<CampaignRecord[]>(["campaigns"])

      queryClient.setQueryData<CampaignRecord[]>(["campaigns"], (current = []) =>
        current.map((campaign) =>
          campaign.id === campaignId ? { ...campaign, status } : campaign
        )
      )

      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["campaigns"], context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["campaigns"] })
    },
  })

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  function handleDragStart(event: DragStartEvent) {
    const campaign = event.active.data.current?.campaign as CampaignRecord | undefined
    setActiveCampaign(campaign ?? null)
  }

  function handleDragOver(event: DragOverEvent) {
    setOverColumn(resolveDropColumn(event.over, campaigns))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCampaign(null)
    setOverColumn(null)

    const campaign = event.active.data.current?.campaign as CampaignRecord | undefined
    const targetColumn = resolveDropColumn(event.over, campaigns)

    if (!campaign || !targetColumn) return

    const currentColumn = getCampaignKanbanColumn(campaign.status)
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
          Arrastra campañas entre columnas para cambiar su estado. Abre una tarjeta
          para editar nombre, status y configuración de estrategia.
        </p>
        <CampaignCreateButton className="shrink-0" />
      </div>

      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {CAMPAIGN_KANBAN_STATUS_VALUES.map((status) => (
            <Skeleton key={status} className={CAMPAIGN_KANBAN_COLUMN_SKELETON_CLASS} />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error instanceof Error ? error.message : "Error al cargar campañas"}
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
              <CampaignKanbanCardView campaign={activeCampaign} isDragging />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}
