"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deleteCustomField,
  saveCustomField,
} from "@/server/actions/workspace-settings";

type Entity = "company" | "contact" | "deal";
type FieldType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "checkbox"
  | "url"
  | "email"
  | "phone";

export type CustomField = {
  id: string;
  entity: Entity;
  key: string;
  label: string;
  type: FieldType;
  options: string[] | null;
};

const ENTITY_LABELS: Record<Entity, string> = {
  company: "Entreprise",
  contact: "Contact",
  deal: "Opportunité",
};

const TYPE_LABELS: Record<FieldType, string> = {
  text: "Texte",
  number: "Nombre",
  date: "Date",
  select: "Liste de choix",
  checkbox: "Case à cocher",
  url: "Lien",
  email: "E-mail",
  phone: "Téléphone",
};

/** Génère un identifiant technique à partir du libellé saisi. */
function slugify(label: string) {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^([0-9])/, "f$1")
    .slice(0, 40);
}

export function CustomFieldsPanel({
  fields,
  canManage,
}: {
  fields: CustomField[];
  canManage: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [entity, setEntity] = useState<Entity>("company");
  const [type, setType] = useState<FieldType>("text");
  const [options, setOptions] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function create() {
    startTransition(async () => {
      const result = await saveCustomField({
        entity,
        key: slugify(label),
        label,
        type,
        options:
          type === "select"
            ? options.split(",").map((o) => o.trim()).filter(Boolean)
            : undefined,
      });

      if (result.ok) {
        toast.success("Champ ajouté");
        setAdding(false);
        setLabel("");
        setOptions("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove(field: CustomField) {
    startTransition(async () => {
      const result = await deleteCustomField(field.id);
      if (result.ok) {
        toast.success(`Champ « ${field.label} » supprimé`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <SlidersHorizontal
            className="size-4 text-muted-foreground"
            strokeWidth={1.75}
            aria-hidden
          />
          Champs personnalisés
        </CardTitle>
        {canManage ? (
          <Button variant="outline" size="sm" onClick={() => setAdding((v) => !v)}>
            <Plus className="size-3.5" strokeWidth={2} aria-hidden />
            Ajouter
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun champ personnalisé. Ajoutes-en pour suivre ce qui compte dans ton
            métier : numéro BCE, type de chantier, référence dossier…
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {fields.map((field) => (
              <li key={field.id} className="flex items-center gap-3 py-2.5 first:pt-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{field.label}</p>
                  <p className="text-xs text-muted-foreground">
                    <code className="font-mono">{field.key}</code> ·{" "}
                    {TYPE_LABELS[field.type]}
                    {field.options?.length ? ` · ${field.options.join(", ")}` : ""}
                  </p>
                </div>

                <Badge variant="secondary">{ENTITY_LABELS[field.entity]}</Badge>

                {canManage ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove(field)}
                    disabled={pending}
                    aria-label={`Supprimer le champ ${field.label}`}
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.75} aria-hidden />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {adding ? (
          <div className="flex flex-col gap-3 rounded-lg border bg-surface p-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cf-label">Libellé</Label>
                <Input
                  id="cf-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="N° BCE"
                  autoFocus
                />
                {label ? (
                  <p className="text-xs text-muted-foreground">
                    Identifiant : <code className="font-mono">{slugify(label)}</code>
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cf-entity">Sur quelle fiche</Label>
                <Select value={entity} onValueChange={(v) => setEntity(v as Entity)}>
                  <SelectTrigger id="cf-entity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ENTITY_LABELS) as Entity[]).map((value) => (
                      <SelectItem key={value} value={value}>
                        {ENTITY_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cf-type">Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as FieldType)}>
                  <SelectTrigger id="cf-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_LABELS) as FieldType[]).map((value) => (
                      <SelectItem key={value} value={value}>
                        {TYPE_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {type === "select" ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cf-options">Choix possibles</Label>
                <Input
                  id="cf-options"
                  value={options}
                  onChange={(e) => setOptions(e.target.value)}
                  placeholder="Neuf, Rénovation, Extension (séparés par une virgule)"
                />
              </div>
            ) : null}

            <div className="flex gap-2">
              <Button size="sm" onClick={create} disabled={pending || !label.trim()}>
                {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                Ajouter le champ
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
                Annuler
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
