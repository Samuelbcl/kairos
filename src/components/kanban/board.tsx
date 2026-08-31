"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { KanbanColumn } from "./column";
import { DealCard } from "./deal-card";
import { moveDeal } from "@/server/actions/deals";

export type BoardStage = {
  id: string;
  name: string;
  color: string;
  probability: number;
  isWon: boolean;
  isLost: boolean;
};

export type BoardDeal = {
  id: string;
  title: string;
  value: number;
  currency: string;
  priority: "low" | "normal" | "high";
  stageId: string;
  companyId: string | null;
  companyName: string | null;
  lastActivityAt: string | null;
  overdueTasks: number;
};

export function KanbanBoard({
  stages,
  deals,
  canManage,
}: {
  stages: BoardStage[];
  deals: BoardDeal[];
  canManage: boolean;
}) {
  const [, startTransition] = useTransition();
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Déplacement optimiste : la carte suit le doigt, le serveur confirme après.
  const [optimisticDeals, applyMove] = useOptimistic(
    deals,
    (current: BoardDeal[], move: { id: string; stageId: string }) =>
      current.map((deal) =>
        deal.id === move.id ? { ...deal, stageId: move.stageId } : deal,
      ),
  );

  const sensors = useSensors(
    // 6 px de tolérance : un clic reste un clic, on n'attrape pas par erreur.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Au doigt, il faut maintenir appuyé un court instant. Avec un capteur
    // unique, un simple balayage horizontal attrapait une carte au lieu de
    // faire défiler le tableau : le kanban devenait impossible à parcourir
    // sur téléphone.
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );

  const byStage = useMemo(() => {
    const map = new Map<string, BoardDeal[]>();
    for (const stage of stages) map.set(stage.id, []);
    for (const deal of optimisticDeals) {
      map.get(deal.stageId)?.push(deal);
    }
    return map;
  }, [stages, optimisticDeals]);

  const dragging = optimisticDeals.find((d) => d.id === draggingId) ?? null;

  function onDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setDraggingId(null);

    const dealId = String(event.active.id);
    const targetStageId = event.over ? String(event.over.id) : null;
    if (!targetStageId) return;

    const deal = optimisticDeals.find((d) => d.id === dealId);
    if (!deal || deal.stageId === targetStageId) return;

    const stage = stages.find((s) => s.id === targetStageId);

    startTransition(async () => {
      applyMove({ id: dealId, stageId: targetStageId });
      const result = await moveDeal({ id: dealId, stage_id: targetStageId });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (stage?.isWon) {
        toast.success(`${deal.title} — gagné`);
      } else if (stage?.isLost) {
        toast.info(`${deal.title} — perdu`);
      }
    });
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      <div className="-mx-4 flex min-h-0 flex-1 gap-3 overflow-x-auto px-4 pb-1 md:-mx-6 md:px-6">
        {stages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            deals={byStage.get(stage.id) ?? []}
            isDragging={draggingId !== null}
            canManage={canManage}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 160, easing: "cubic-bezier(.22,1,.36,1)" }}>
        {dragging ? <DealCard deal={dragging} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
