"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, RefreshCw, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createTag,
  deleteTag,
  recolorTag,
  renameTag,
  syncTags,
} from "@/server/actions/tags";

export type WorkspaceTag = {
  name: string;
  color: string;
  usage: number;
};

export function TagsPanel({
  tags,
  canManage,
}: {
  tags: WorkspaceTag[];
  canManage: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#94A3B8");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function rename(tag: WorkspaceTag, value: string) {
    const next = value.trim();
    if (!next || next === tag.name) return;

    startTransition(async () => {
      const result = await renameTag(tag.name, next);
      if (result.ok) {
        toast.success(`Tag renommé en « ${next} »`, {
          description:
            tag.usage > 0
              ? `${tag.usage} fiche${tag.usage > 1 ? "s" : ""} mise${tag.usage > 1 ? "s" : ""} à jour.`
              : undefined,
        });
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function recolor(tag: WorkspaceTag, color: string) {
    startTransition(async () => {
      const result = await recolorTag(tag.name, color);
      if (result.ok) router.refresh();
      else toast.error(result.error);
    });
  }

  function remove(tag: WorkspaceTag) {
    startTransition(async () => {
      const result = await deleteTag(tag.name);
      if (result.ok) {
        toast.success(`Tag « ${tag.name} » supprimé`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function add() {
    startTransition(async () => {
      const result = await createTag({ name: newName, color: newColor });
      if (result.ok) {
        toast.success("Tag créé");
        setNewName("");
        setAdding(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function sync() {
    startTransition(async () => {
      const result = await syncTags();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data.added > 0
          ? `${result.data.added} tag${result.data.added > 1 ? "s" : ""} récupéré${result.data.added > 1 ? "s" : ""} depuis tes fiches`
          : "Tous tes tags sont déjà répertoriés.",
      );
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Tags className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden />
          Tags
        </CardTitle>
        {canManage ? (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={sync} disabled={pending}>
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="size-3.5" strokeWidth={1.75} aria-hidden />
              )}
              Récupérer depuis les fiches
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAdding((v) => !v)}>
              <Plus className="size-3.5" strokeWidth={2} aria-hidden />
              Ajouter
            </Button>
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun tag répertorié. Si tes fiches en portent déjà — après un import,
            par exemple — clique « Récupérer depuis les fiches ».
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {tags.map((tag) => (
              <li key={tag.name} className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0">
                <input
                  type="color"
                  value={tag.color}
                  onChange={(e) => recolor(tag, e.target.value)}
                  disabled={!canManage || pending}
                  aria-label={`Couleur du tag ${tag.name}`}
                  className="size-7 shrink-0 cursor-pointer rounded-md border bg-transparent"
                />

                <Input
                  defaultValue={tag.name}
                  onBlur={(e) => rename(tag, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  disabled={!canManage || pending}
                  aria-label={`Nom du tag ${tag.name}`}
                  className="h-8 min-w-32 flex-1"
                />

                <span className="tabular shrink-0 text-xs text-muted-foreground">
                  {tag.usage} fiche{tag.usage > 1 ? "s" : ""}
                </span>

                {canManage ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove(tag)}
                    disabled={pending}
                    aria-label={`Supprimer le tag ${tag.name}`}
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.75} aria-hidden />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {adding ? (
          <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-surface p-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tag-color">Couleur</Label>
              <input
                id="tag-color"
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="h-8 w-12 cursor-pointer rounded-md border bg-transparent"
              />
            </div>
            <div className="flex min-w-32 flex-1 flex-col gap-1.5">
              <Label htmlFor="tag-name">Nom</Label>
              <Input
                id="tag-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="À rappeler"
                autoFocus
                className="h-8"
              />
            </div>
            <Button size="sm" onClick={add} disabled={pending || !newName.trim()}>
              {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
              Ajouter
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Annuler
            </Button>
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Renommer un tag le met à jour sur toutes les fiches qui le portent. Si tu
          lui donnes le nom d&apos;un tag existant, les deux fusionnent — pratique
          pour nettoyer « a rappeler » et « À rappeler » après un import.
        </p>
      </CardContent>
    </Card>
  );
}
