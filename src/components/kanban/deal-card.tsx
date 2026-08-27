"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock } from "lucide-react";
import type { BoardDeal } from "./board";
import { formatMoney, formatRelative, isStale } from "@/lib/format";
import { cn } from "@/lib/utils";

const PRIORITY_DOT: Record<BoardDeal["priority"], string> = {
  low: "bg-muted-foreground/40",
  normal: "bg-info",
  high: "bg-warning",
};

const PRIORITY_LABEL: Record<BoardDeal["priority"], string> = {
  low: "Priorité basse",
  normal: "Priorité normale",
  high: "Priorité haute",
};

/** Une opportunité qui n'a pas bougé depuis 14 jours mérite un coup d'œil. */
const STALE_DAYS = 14;

export function DealCard({ deal, overlay }: { deal: BoardDeal; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    disabled: overlay,
  });

  const stale = isStale(deal.lastActivityAt, STALE_DAYS);

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "group rounded-md border bg-card p-2.5 shadow-[var(--shadow-soft)] transition-shadow duration-150",
        overlay && "rotate-2 cursor-grabbing shadow-lg",
        isDragging && "opacity-40",
      )}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", PRIORITY_DOT[deal.priority])}
          aria-label={PRIORITY_LABEL[deal.priority]}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{deal.title}</p>

          {deal.companyName ? (
            overlay ? (
              <span className="truncate text-xs text-muted-foreground">
                {deal.companyName}
              </span>
            ) : (
              <Link
                href={`/companies/${deal.companyId}`}
                onPointerDown={(e) => e.stopPropagation()}
                className="block truncate text-xs text-muted-foreground hover:underline"
              >
                {deal.companyName}
              </Link>
            )
          ) : null}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        {deal.value > 0 ? (
          <span className="tabular text-xs font-medium">
            {formatMoney(deal.value, deal.currency)}
          </span>
        ) : null}

        {deal.overdueTasks > 0 ? (
          <span className="flex items-center gap-1 text-xs text-danger">
            <CalendarClock className="size-3" strokeWidth={2} aria-hidden />
            {deal.overdueTasks} en retard
          </span>
        ) : null}

        {stale && deal.overdueTasks === 0 ? (
          <span
            className="text-xs text-warning"
            title={`Aucune activité depuis ${STALE_DAYS} jours`}
          >
            Dort depuis {formatRelative(deal.lastActivityAt!).replace("il y a ", "")}
          </span>
        ) : null}
      </div>
    </article>
  );
}
