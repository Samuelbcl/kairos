"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Tag, Target, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  bulkCreateDeals,
  bulkDelete,
  bulkRestore,
  bulkUpdateTags,
} from "@/server/actions/bulk";

/**
 * Barre d'actions groupées, affichée dès qu'une fiche est cochée.
 * Elle flotte en bas : la sélection se fait en haut de l'écran, l'action
 * ne doit pas obliger à remonter.
 */
export function BulkBar({
  entity,
  ids,
  onClear,
  tags,
  stages,
}: {
  entity: "company" | "contact";
  ids: string[];
  onClear: () => void;
  tags: { name: string; color: string }[];
  stages: { id: string; name: string }[];
}) {
  const [tagInput, setTagInput] = useState("");
  const [stageId, setStageId] = useState(stages[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const count = ids.length;
  const noun = entity === "company" ? "entreprise" : "contact";

  function applyTag(name: string, mode: "add" | "remove") {
    const value = name.trim();
    if (!value) return;

    startTransition(async () => {
      const result = await bulkUpdateTags({
        entity,
        ids,
        add: mode === "add" ? [value] : [],
        remove: mode === "remove" ? [value] : [],
      });

      if (result.ok) {
        toast.success(
          mode === "add"
            ? `« ${value} » ajouté à ${result.data.updated} fiche${result.data.updated > 1 ? "s" : ""}`
            : `« ${value} » retiré de ${result.data.updated} fiche${result.data.updated > 1 ? "s" : ""}`,
        );
        setTagInput("");
        onClear();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function createDeals() {
    startTransition(async () => {
      const result = await bulkCreateDeals({ entity: "company", ids, stageId });
      if (result.ok) {
        toast.success(
          `${result.data.created} opportunité${result.data.created > 1 ? "s" : ""} créée${result.data.created > 1 ? "s" : ""}`,
        );
        onClear();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove() {
    // Capturé maintenant : onClear() vide la sélection avant le toast.
    const removed = [...ids];

    startTransition(async () => {
      const result = await bulkDelete({ entity, ids: removed });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      onClear();
      router.refresh();

      toast.success(
        `${result.data.deleted} ${noun}${result.data.deleted > 1 ? "s" : ""} mis${result.data.deleted > 1 ? "es" : "e"} à la corbeille`,
        {
          description: "Récupérable pendant trente jours.",
          action: {
            label: "Annuler",
            onClick: () => {
              startTransition(async () => {
                const undo = await bulkRestore({ entity, ids: removed });
                if (undo.ok) {
                  toast.success("Restauré");
                  router.refresh();
                } else {
                  toast.error(undo.error);
                }
              });
            },
          },
        },
      );
    });
  }

  return (
    <div className="pointer-events-none sticky bottom-4 z-20 flex justify-center">
      <div
        role="toolbar"
        aria-label={`Actions sur ${count} ${noun}${count > 1 ? "s" : ""}`}
        className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-full border bg-card px-3 py-2 shadow-[var(--shadow-soft)]"
      >
        <span className="tabular px-1 text-sm font-medium">
          {count} {noun}
          {count > 1 ? "s" : ""}
        </span>

        <Popover>
          <PopoverTrigger
            render={
              <Button variant="outline" size="sm" disabled={pending}>
                <Tag className="size-3.5" strokeWidth={1.75} aria-hidden />
                Tags
              </Button>
            }
          />
          <PopoverContent align="center" className="w-64">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bulk-tag">Ajouter un tag</Label>
                <div className="flex gap-1.5">
                  <Input
                    id="bulk-tag"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyTag(tagInput, "add");
                      }
                    }}
                    placeholder="À rappeler"
                    className="h-8"
                  />
                  <Button
                    size="sm"
                    onClick={() => applyTag(tagInput, "add")}
                    disabled={pending || !tagInput.trim()}
                  >
                    Ajouter
                  </Button>
                </div>
              </div>

              {tags.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-muted-foreground">
                    Tags existants — clic pour ajouter, ⌥ + clic pour retirer
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {tags.map((tag) => (
                      <button
                        key={tag.name}
                        type="button"
                        disabled={pending}
                        onClick={(e) => applyTag(tag.name, e.altKey ? "remove" : "add")}
                        className="rounded-full border px-2 py-0.5 text-xs transition-colors duration-150 hover:bg-accent"
                        style={{ borderColor: tag.color, color: tag.color }}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </PopoverContent>
        </Popover>

        {entity === "company" && stages.length > 0 ? (
          <Popover>
            <PopoverTrigger
              render={
                <Button variant="outline" size="sm" disabled={pending}>
                  <Target className="size-3.5" strokeWidth={1.75} aria-hidden />
                  Créer des opportunités
                </Button>
              }
            />
            <PopoverContent align="center" className="w-64">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="bulk-stage">Étape de départ</Label>
                  <Select value={stageId} onValueChange={(v) => setStageId(String(v))}>
                    <SelectTrigger id="bulk-stage" className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Une entreprise qui a déjà une opportunité ouverte est ignorée.
                </p>
                <Button size="sm" onClick={createDeals} disabled={pending || !stageId}>
                  Créer
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        ) : null}

        <Button variant="ghost" size="sm" onClick={remove} disabled={pending}>
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="size-3.5" strokeWidth={1.75} aria-hidden />
          )}
          Supprimer
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClear}
          disabled={pending}
          aria-label="Annuler la sélection"
        >
          <X className="size-3.5" strokeWidth={2} aria-hidden />
        </Button>
      </div>
    </div>
  );
}
