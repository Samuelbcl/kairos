"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Type } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ENTITY_LABELS,
  FIELD_DEFINITIONS,
  labelKey,
  type FieldLabelOverrides,
  type LabelledEntity,
} from "@/lib/field-labels";
import { saveFieldLabels } from "@/server/actions/workspace-settings";

/**
 * Renommer les champs intégrés.
 *
 * Le champ vide affiche le nom d'origine en indication : on voit donc toujours
 * ce que l'on remplace, et l'effacer suffit à revenir en arrière.
 */
export function FieldLabelsPanel({
  labels,
}: {
  labels: FieldLabelOverrides;
}) {
  const [values, setValues] = useState<FieldLabelOverrides>(labels);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const changed = JSON.stringify(values) !== JSON.stringify(labels);

  function set(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function submit() {
    startTransition(async () => {
      const result = await saveFieldLabels(values);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Noms des champs enregistrés.");
      router.refresh();
    });
  }

  function reset() {
    setValues({});
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <div className="flex items-center gap-2">
          <Type className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden />
          <CardTitle className="text-sm">Noms des champs</CardTitle>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={reset}
          disabled={pending || Object.keys(values).length === 0}
        >
          <RotateCcw className="size-3.5" strokeWidth={1.75} aria-hidden />
          Tout réinitialiser
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">
          Emploie le vocabulaire de ton métier. « Raison sociale » plutôt que
          « Nom », « Chantier » plutôt que « Secteur » : seul l&apos;affichage
          change, tes données et tes imports ne bougent pas. Laisse une case
          vide pour garder le nom d&apos;origine.
        </p>

        {(Object.keys(FIELD_DEFINITIONS) as LabelledEntity[]).map((entity) => (
          <div key={entity} className="flex flex-col gap-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase">
              {ENTITY_LABELS[entity]}
            </h3>

            <div className="grid gap-3 sm:grid-cols-2">
              {FIELD_DEFINITIONS[entity].map((definition) => {
                const key = labelKey(entity, definition.field);
                const id = `label-${key.replace(".", "-")}`;

                return (
                  <div key={key} className="flex flex-col gap-1.5">
                    <Label htmlFor={id} className="text-xs text-muted-foreground">
                      {definition.label}
                    </Label>
                    <Input
                      id={id}
                      value={values[key] ?? ""}
                      placeholder={definition.label}
                      maxLength={40}
                      onChange={(event) => set(key, event.target.value)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="flex items-center gap-3">
          <Button onClick={submit} disabled={pending || !changed}>
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} aria-hidden />
            ) : null}
            Enregistrer
          </Button>

          {changed ? (
            <span className="text-xs text-muted-foreground">
              Modifications non enregistrées.
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
