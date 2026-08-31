"use client";

import { useDroppable } from "@dnd-kit/core";
import { DealCard } from "./deal-card";
import { StageHeader } from "./stage-header";
import type { BoardDeal, BoardStage } from "./board";
import { cn } from "@/lib/utils";

export function KanbanColumn({
  stage,
  deals,
  isDragging,
  canManage,
}: {
  stage: BoardStage;
  deals: BoardDeal[];
  isDragging: boolean;
  canManage: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  const total = deals.reduce((sum, deal) => sum + deal.value, 0);

  return (
    <section
      ref={setNodeRef}
      aria-label={`Étape ${stage.name}`}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-lg border bg-card transition-colors duration-150",
        isOver && "border-primary bg-brand-soft",
      )}
    >
      <StageHeader
        stage={stage}
        count={deals.length}
        total={total}
        currency={deals[0]?.currency ?? "EUR"}
        canManage={canManage}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} />
        ))}

        {deals.length === 0 ? (
          <p
            className={cn(
              "rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground transition-colors duration-150",
              isDragging && "border-primary/50",
            )}
          >
            {isDragging ? "Déposer ici" : "Aucune opportunité"}
          </p>
        ) : null}
      </div>
    </section>
  );
}
