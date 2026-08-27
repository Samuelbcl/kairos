"use client";

import { useDroppable } from "@dnd-kit/core";
import { DealCard } from "./deal-card";
import type { BoardDeal, BoardStage } from "./board";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export function KanbanColumn({
  stage,
  deals,
  isDragging,
}: {
  stage: BoardStage;
  deals: BoardDeal[];
  isDragging: boolean;
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
      <header className="flex items-center gap-2 border-b px-3 py-2.5">
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: stage.color }}
          aria-hidden
        />
        <h2 className="min-w-0 flex-1 truncate text-sm font-medium">{stage.name}</h2>
        <span className="tabular text-xs text-muted-foreground">{deals.length}</span>
      </header>

      {total > 0 ? (
        <p className="tabular border-b px-3 py-1.5 text-xs text-muted-foreground">
          {formatMoney(total, deals[0]?.currency ?? "EUR")}
        </p>
      ) : null}

      <div className="flex min-h-24 flex-1 flex-col gap-2 p-2">
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
