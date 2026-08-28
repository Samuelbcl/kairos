"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Loader2, Plus, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteStage,
  reorderStages,
  saveStage,
} from "@/server/actions/workspace-settings";

type Stage = {
  id: string;
  name: string;
  color: string;
  position: number;
  probability: number;
  is_won: boolean;
  is_lost: boolean;
};

export function StagesPanel({
  stages,
  canManage,
}: {
  stages: Stage[];
  canManage: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function update(stage: Stage, patch: Partial<Stage>) {
    startTransition(async () => {
      const result = await saveStage({ ...stage, ...patch });
      if (result.ok) router.refresh();
      else toast.error(result.error);
    });
  }

  function create(formData: FormData) {
    startTransition(async () => {
      const result = await saveStage({
        name: formData.get("name"),
        color: formData.get("color"),
        probability: formData.get("probability"),
        is_won: false,
        is_lost: false,
      });

      if (result.ok) {
        toast.success("Étape ajoutée");
        setAdding(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove(stage: Stage) {
    startTransition(async () => {
      const result = await deleteStage(stage.id);
      if (result.ok) {
        toast.success(`Étape « ${stage.name} » supprimée`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function move(index: number, direction: -1 | 1) {
    const next = [...stages];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;

    [next[index], next[target]] = [next[target], next[index]];

    startTransition(async () => {
      const result = await reorderStages(next.map((s) => s.id));
      if (result.ok) router.refresh();
      else toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Target className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden />
          Étapes du pipeline
        </CardTitle>
        {canManage ? (
          <Button variant="outline" size="sm" onClick={() => setAdding((v) => !v)}>
            <Plus className="size-3.5" strokeWidth={2} aria-hidden />
            Ajouter
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <ul className="flex flex-col divide-y">
          {stages.map((stage, index) => (
            <li key={stage.id} className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0">
              <input
                type="color"
                value={stage.color}
                onChange={(e) => update(stage, { color: e.target.value })}
                disabled={!canManage || pending}
                aria-label={`Couleur de l'étape ${stage.name}`}
                className="size-7 shrink-0 cursor-pointer rounded-md border bg-transparent"
              />

              <Input
                defaultValue={stage.name}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== stage.name) {
                    update(stage, { name: e.target.value.trim() });
                  }
                }}
                disabled={!canManage || pending}
                aria-label={`Nom de l'étape ${stage.name}`}
                className="h-8 min-w-32 flex-1"
              />

              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  defaultValue={stage.probability}
                  onBlur={(e) => {
                    const value = Number(e.target.value);
                    if (value !== stage.probability) update(stage, { probability: value });
                  }}
                  disabled={!canManage || pending}
                  aria-label={`Probabilité de l'étape ${stage.name}`}
                  className="h-8 w-16"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>

              {stage.is_won ? (
                <span className="text-xs text-success">Gagnée</span>
              ) : stage.is_lost ? (
                <span className="text-xs text-muted-foreground">Perdue</span>
              ) : null}

              {canManage ? (
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => move(index, -1)}
                    disabled={index === 0 || pending}
                    aria-label={`Remonter ${stage.name}`}
                  >
                    <ChevronUp className="size-3.5" strokeWidth={2} aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => move(index, 1)}
                    disabled={index === stages.length - 1 || pending}
                    aria-label={`Descendre ${stage.name}`}
                  >
                    <ChevronDown className="size-3.5" strokeWidth={2} aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => remove(stage)}
                    disabled={pending}
                    aria-label={`Supprimer ${stage.name}`}
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.75} aria-hidden />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>

        {adding ? (
          <form
            action={create}
            className="flex flex-wrap items-end gap-2 rounded-lg border bg-surface p-3"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="stage-color">Couleur</Label>
              <input
                id="stage-color"
                name="color"
                type="color"
                defaultValue="#6C8CFF"
                className="h-8 w-12 cursor-pointer rounded-md border bg-transparent"
              />
            </div>
            <div className="flex min-w-32 flex-1 flex-col gap-1.5">
              <Label htmlFor="stage-name">Nom</Label>
              <Input id="stage-name" name="name" required autoFocus className="h-8" />
            </div>
            <div className="flex w-24 flex-col gap-1.5">
              <Label htmlFor="stage-prob">Proba (%)</Label>
              <Input
                id="stage-prob"
                name="probability"
                type="number"
                min="0"
                max="100"
                defaultValue="50"
                className="h-8"
              />
            </div>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
              Ajouter
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Annuler
            </Button>
          </form>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Les étapes marquées « gagnée » ou « perdue » basculent automatiquement le
          statut de l&apos;opportunité. Une étape qui contient encore des opportunités
          ne peut pas être supprimée.
        </p>
      </CardContent>
    </Card>
  );
}
