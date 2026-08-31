"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { moveDeal } from "@/server/actions/deals";

export type StageOption = {
  id: string;
  name: string;
  color: string;
  isWon: boolean;
  isLost: boolean;
};

/**
 * Change l'étape d'une opportunité sans passer par le pipeline.
 *
 * Depuis une fiche entreprise, on veut souvent juste dire « on est passé au
 * devis » : ouvrir le kanban, retrouver la carte et la faire glisser pour ça
 * est un détour. Même action serveur que le glisser-déposer, donc mêmes
 * automatisations et mêmes webhooks déclenchés.
 */
export function DealStageSelect({
  dealId,
  stageId,
  stages,
}: {
  dealId: string;
  stageId: string | null;
  stages: StageOption[];
}) {
  const [current, setCurrent] = useState(stageId);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const stage = stages.find((s) => s.id === current);

  function onChange(next: string | null) {
    if (!next || next === current) return;

    const previous = current;
    setCurrent(next);

    startTransition(async () => {
      const result = await moveDeal({ id: dealId, stage_id: next });

      if (!result.ok) {
        setCurrent(previous);
        toast.error(result.error);
        return;
      }

      const target = stages.find((s) => s.id === next);
      if (target?.isWon) toast.success(`Opportunité gagnée : ${target.name}`);
      else if (target?.isLost) toast.info(`Opportunité perdue : ${target.name}`);
      else toast.success(`Étape : ${target?.name}`);

      router.refresh();
    });
  }

  return (
    <Select value={current ?? ""} onValueChange={onChange} disabled={pending}>
      <SelectTrigger
        aria-label="Étape de l'opportunité"
        className="h-7 w-auto gap-1.5 border-0 px-2 text-xs font-medium shadow-none"
        style={
          stage
            ? {
                backgroundColor: `color-mix(in oklch, ${stage.color} 15%, transparent)`,
                color: stage.color,
              }
            : undefined
        }
      >
        {stage?.name ?? "Sans étape"}
      </SelectTrigger>

      <SelectContent>
        {stages.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: option.color }}
              />
              {option.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
