"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveStage } from "@/server/actions/workspace-settings";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BoardStage } from "./board";

/**
 * En-tête de colonne éditable sur place.
 *
 * La personnalisation existait déjà dans les réglages, mais personne n'y allait :
 * le besoin de renommer une étape naît devant le pipeline, pas dans un menu.
 */
export function StageHeader({
  stage,
  count,
  total,
  currency,
  canManage,
}: {
  stage: BoardStage;
  count: number;
  total: number;
  currency: string;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function rename(value: string) {
    const next = value.trim();
    setEditing(false);
    if (!next || next === stage.name) return;

    startTransition(async () => {
      const result = await saveStage({
        id: stage.id,
        name: next,
        color: stage.color,
        probability: stage.probability,
        is_won: stage.isWon,
        is_lost: stage.isLost,
      });
      if (result.ok) {
        toast.success(`Étape renommée en « ${next} »`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function recolor(color: string) {
    startTransition(async () => {
      const result = await saveStage({
        id: stage.id,
        name: stage.name,
        color,
        probability: stage.probability,
        is_won: stage.isWon,
        is_lost: stage.isLost,
      });
      if (result.ok) router.refresh();
      else toast.error(result.error);
    });
  }

  return (
    <header className="flex flex-col gap-1 border-b px-3 py-2.5">
      <div className="flex items-center gap-2">
        {canManage ? (
          <label className="relative shrink-0 cursor-pointer" title="Changer la couleur">
            <span
              className="block size-2.5 rounded-full"
              style={{ backgroundColor: stage.color }}
            />
            <input
              type="color"
              value={stage.color}
              onChange={(e) => recolor(e.target.value)}
              disabled={pending}
              aria-label={`Couleur de l'étape ${stage.name}`}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
          </label>
        ) : (
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: stage.color }}
            aria-hidden
          />
        )}

        {editing ? (
          <input
            autoFocus
            defaultValue={stage.name}
            onBlur={(e) => rename(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setEditing(false);
            }}
            aria-label={`Nom de l'étape ${stage.name}`}
            className="min-w-0 flex-1 rounded border bg-background px-1.5 py-0.5 text-sm font-medium outline-none focus-visible:border-primary"
          />
        ) : (
          <h2 className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => canManage && setEditing(true)}
              disabled={!canManage || pending}
              data-tour="stage-name"
              title={canManage ? "Cliquer pour renommer" : undefined}
              className={cn(
                "w-full truncate rounded px-1 py-0.5 text-left text-sm font-medium transition-colors duration-150",
                canManage && "hover:bg-accent",
              )}
            >
              {stage.name}
            </button>
          </h2>
        )}

        <span className="tabular shrink-0 text-xs text-muted-foreground">{count}</span>
      </div>

      {total > 0 ? (
        <span className="tabular pl-4 text-xs text-muted-foreground">
          {formatMoney(total, currency)}
        </span>
      ) : null}
    </header>
  );
}
