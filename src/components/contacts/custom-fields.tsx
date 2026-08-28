"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { InlineEdit } from "./inline-edit";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActionResult } from "@/server/actions/types";
import type { CustomField } from "@/components/settings/custom-fields-panel";

type Values = Record<string, string | number | boolean | null>;

const NONE = "__none__";

/**
 * Rend les champs personnalisés d'un espace. Les valeurs vivent dans la colonne
 * `custom` (jsonb) de l'entité : on renvoie l'objet complet à chaque écriture.
 */
export function CustomFields({
  fields,
  values,
  onSave,
}: {
  fields: CustomField[];
  values: Values;
  onSave: (custom: Values) => Promise<ActionResult<unknown>>;
}) {
  const [pending, startTransition] = useTransition();

  if (fields.length === 0) return null;

  async function saveText(key: string, value: string) {
    return onSave({ ...values, [key]: value || null });
  }

  function saveDirect(key: string, value: string | boolean | null) {
    startTransition(async () => {
      const result = await onSave({ ...values, [key]: value });
      if (result.ok) toast.success("Champ mis à jour");
      else toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-col divide-y border-t pt-1">
      {fields.map((field) => {
        const raw = values[field.key];

        if (field.type === "checkbox") {
          return (
            <div
              key={field.id}
              className="grid grid-cols-[8rem_1fr] items-center gap-3 py-2"
            >
              <Label
                htmlFor={`cf-${field.key}`}
                className="text-sm font-normal text-muted-foreground"
              >
                {field.label}
              </Label>
              <Checkbox
                id={`cf-${field.key}`}
                checked={raw === true}
                disabled={pending}
                onCheckedChange={(checked) => saveDirect(field.key, checked === true)}
              />
            </div>
          );
        }

        if (field.type === "select") {
          return (
            <div
              key={field.id}
              className="grid grid-cols-[8rem_1fr] items-center gap-3 py-1.5"
            >
              <Label
                htmlFor={`cf-${field.key}`}
                className="text-sm font-normal text-muted-foreground"
              >
                {field.label}
              </Label>
              <Select
                value={raw ? String(raw) : NONE}
                disabled={pending}
                onValueChange={(v) =>
                  saveDirect(field.key, String(v) === NONE ? null : String(v))
                }
              >
                <SelectTrigger id={`cf-${field.key}`} className="h-8">
                  <SelectValue placeholder="Non renseigné" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Non renseigné</SelectItem>
                  {(field.options ?? []).map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }

        const inputType =
          field.type === "email"
            ? "email"
            : field.type === "phone"
              ? "tel"
              : field.type === "url"
                ? "url"
                : "text";

        return (
          <InlineEdit
            key={field.id}
            label={field.label}
            field={field.key}
            value={raw == null ? null : String(raw)}
            type={inputType}
            onSave={saveText}
          />
        );
      })}
    </div>
  );
}
