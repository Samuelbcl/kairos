"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveAutomation } from "@/server/actions/automations";
import { RuleSummary } from "./rule-summary";
import {
  ACTION_LABELS,
  ACTION_TYPES,
  CONDITION_FIELDS,
  OPERATOR_LABELS,
  OPERATORS,
  TRIGGER_EVENTS,
  TRIGGER_LABELS,
  type Action,
  type ActionType,
  type Condition,
  type Operator,
  type Rule,
  type TriggerEvent,
} from "@/lib/automations/types";

type Stage = { id: string; name: string };

const DEFAULT_PARAMS: Record<ActionType, Record<string, unknown>> = {
  "task.create": { title: "Relancer {{company.name}}", due_in_days: 5, remind_min: 60 },
  "calendar.create_event": { from_task: true },
  "email.send": { to: "{{company.email}}", subject: "", body: "" },
  "deal.move": { stage_id: "" },
  "deal.set": { field: "priority", value: "high" },
  "company.set": { field: "sector", value: "" },
  "contact.set": { field: "role_title", value: "" },
  "activity.log": { subject_type: "company", content: "" },
  "webhook.post": {},
};

/** Composeur « Quand… si… alors… ». Aucun JSON n'est exposé à l'utilisateur. */
export function RuleDialog({
  stages,
  rule,
  trigger: triggerButton,
}: {
  stages: Stage[];
  rule?: Rule;
  /** Base UI attend un élément, pas un ReactNode quelconque. */
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(rule?.name ?? "");
  const [event, setEvent] = useState<TriggerEvent>(rule?.trigger.event ?? "deal.stage_changed");
  const [toStage, setToStage] = useState(rule?.trigger.to_stage ?? stages[0]?.id ?? "");
  const [days, setDays] = useState(String(rule?.trigger.days ?? 14));
  const [conditions, setConditions] = useState<Condition[]>(rule?.conditions ?? []);
  const [actions, setActions] = useState<Action[]>(
    rule?.actions ?? [{ type: "task.create", params: DEFAULT_PARAMS["task.create"] }],
  );
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const trigger = {
    event,
    ...(event === "deal.stage_changed" ? { to_stage: toStage } : {}),
    ...(event === "deal.stale" ? { days: Number(days) } : {}),
  };

  function submit() {
    startTransition(async () => {
      const result = await saveAutomation({
        id: rule?.id,
        name,
        enabled: rule?.enabled ?? true,
        trigger,
        conditions,
        actions,
      });

      if (result.ok) {
        toast.success(rule ? "Règle mise à jour" : "Règle créée");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function updateAction(index: number, patch: Partial<Action>) {
    setActions((current) =>
      current.map((action, i) => (i === index ? { ...action, ...patch } : action)),
    );
  }

  function updateParam(index: number, key: string, value: unknown) {
    setActions((current) =>
      current.map((action, i) =>
        i === index ? { ...action, params: { ...action.params, [key]: value } } : action,
      ),
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          triggerButton ?? (
            <Button>
              <Plus className="size-4" strokeWidth={2} aria-hidden />
              Nouvelle règle
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{rule ? "Modifier la règle" : "Nouvelle règle"}</DialogTitle>
          <DialogDescription>
            Compose la règle en langage courant. Elle s&apos;exécute à chaque fois que
            la condition est remplie.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rule-name">Nom de la règle</Label>
            <Input
              id="rule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Relance systématique après contact"
            />
          </div>

          {/* Quand */}
          <fieldset className="flex flex-col gap-2 rounded-lg border bg-surface p-3">
            <legend className="px-1 text-xs font-medium text-muted-foreground">Quand</legend>
            <Select value={event} onValueChange={(v) => setEvent(v as TriggerEvent)}>
              <SelectTrigger aria-label="Déclencheur">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_EVENTS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {TRIGGER_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {event === "deal.stage_changed" ? (
              <Select value={toStage} onValueChange={(v) => setToStage(String(v))}>
                <SelectTrigger aria-label="Étape cible">
                  <SelectValue placeholder="Choisis une étape" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}

            {event === "deal.stale" ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  max="365"
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  className="w-24"
                  aria-label="Nombre de jours"
                />
                <span className="text-sm text-muted-foreground">jours sans activité</span>
              </div>
            ) : null}
          </fieldset>

          {/* Si */}
          <fieldset className="flex flex-col gap-2 rounded-lg border bg-surface p-3">
            <legend className="px-1 text-xs font-medium text-muted-foreground">
              Si (facultatif)
            </legend>

            {conditions.map((condition, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2">
                <Select
                  value={condition.field}
                  onValueChange={(v) =>
                    setConditions((c) =>
                      c.map((item, i) => (i === index ? { ...item, field: String(v) } : item)),
                    )
                  }
                >
                  <SelectTrigger className="min-w-44 flex-1" aria-label="Champ">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_FIELDS.map((field) => (
                      <SelectItem key={field.value} value={field.value}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={condition.op}
                  onValueChange={(v) =>
                    setConditions((c) =>
                      c.map((item, i) =>
                        i === index ? { ...item, op: v as Operator } : item,
                      ),
                    )
                  }
                >
                  <SelectTrigger className="w-40" aria-label="Opérateur">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((op) => (
                      <SelectItem key={op} value={op}>
                        {OPERATOR_LABELS[op]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {condition.op !== "is_empty" && condition.op !== "is_set" ? (
                  <Input
                    value={String(condition.value ?? "")}
                    onChange={(e) =>
                      setConditions((c) =>
                        c.map((item, i) =>
                          i === index ? { ...item, value: e.target.value } : item,
                        ),
                      )
                    }
                    placeholder="Valeur"
                    className="min-w-32 flex-1"
                    aria-label="Valeur"
                  />
                ) : null}

                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Retirer la condition"
                  onClick={() => setConditions((c) => c.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-3.5" strokeWidth={1.75} aria-hidden />
                </Button>
              </div>
            ))}

            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() =>
                setConditions((c) => [...c, { field: "company.email", op: "is_set" }])
              }
            >
              <Plus className="size-3.5" strokeWidth={2} aria-hidden />
              Ajouter une condition
            </Button>
          </fieldset>

          {/* Alors */}
          <fieldset className="flex flex-col gap-3 rounded-lg border bg-surface p-3">
            <legend className="px-1 text-xs font-medium text-muted-foreground">Alors</legend>

            {actions.map((action, index) => (
              <div key={index} className="flex flex-col gap-2 rounded-md border bg-card p-2.5">
                <div className="flex items-center gap-2">
                  <Select
                    value={action.type}
                    onValueChange={(v) =>
                      updateAction(index, {
                        type: v as ActionType,
                        params: DEFAULT_PARAMS[v as ActionType],
                      })
                    }
                  >
                    <SelectTrigger className="flex-1" aria-label="Action">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTION_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {ACTION_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {actions.length > 1 ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Retirer l'action"
                      onClick={() => setActions((a) => a.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="size-3.5" strokeWidth={1.75} aria-hidden />
                    </Button>
                  ) : null}
                </div>

                <ActionParams
                  action={action}
                  stages={stages}
                  onChange={(key, value) => updateParam(index, key, value)}
                />
              </div>
            ))}

            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() =>
                setActions((a) => [
                  ...a,
                  { type: "activity.log", params: DEFAULT_PARAMS["activity.log"] },
                ])
              }
            >
              <Plus className="size-3.5" strokeWidth={2} aria-hidden />
              Ajouter une action
            </Button>
          </fieldset>

          <div className="rounded-lg border bg-brand-soft p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Aperçu</p>
            <RuleSummary
              trigger={trigger}
              conditions={conditions}
              actions={actions}
              stages={stages}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={pending || !name.trim()}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {rule ? "Enregistrer" : "Créer la règle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Champs spécifiques à chaque type d'action. */
function ActionParams({
  action,
  stages,
  onChange,
}: {
  action: Action;
  stages: Stage[];
  onChange: (key: string, value: unknown) => void;
}) {
  const params = action.params ?? {};

  switch (action.type) {
    case "task.create":
      return (
        <div className="grid gap-2 sm:grid-cols-[1fr_7rem_7rem]">
          <Input
            value={String(params.title ?? "")}
            onChange={(e) => onChange("title", e.target.value)}
            placeholder="Titre — {{company.name}} est remplacé"
            aria-label="Titre de la relance"
          />
          <Input
            type="number"
            min="0"
            value={String(params.due_in_days ?? 5)}
            onChange={(e) => onChange("due_in_days", Number(e.target.value))}
            aria-label="Jours avant échéance"
            placeholder="J+"
          />
          <Input
            type="number"
            min="0"
            value={String(params.remind_min ?? 60)}
            onChange={(e) => onChange("remind_min", Number(e.target.value))}
            aria-label="Minutes de rappel"
            placeholder="Rappel (min)"
          />
        </div>
      );

    case "email.send":
      return (
        <div className="flex flex-col gap-2">
          <Input
            value={String(params.to ?? "")}
            onChange={(e) => onChange("to", e.target.value)}
            placeholder="Destinataire — {{company.email}}"
            aria-label="Destinataire"
          />
          <Input
            value={String(params.subject ?? "")}
            onChange={(e) => onChange("subject", e.target.value)}
            placeholder="Objet"
            aria-label="Objet"
          />
          <textarea
            value={String(params.body ?? "")}
            onChange={(e) => onChange("body", e.target.value)}
            rows={3}
            placeholder="Message"
            aria-label="Message"
            className="rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
      );

    case "deal.move":
      return (
        <Select
          value={String(params.stage_id ?? "")}
          onValueChange={(v) => onChange("stage_id", String(v))}
        >
          <SelectTrigger aria-label="Étape de destination">
            <SelectValue placeholder="Étape de destination" />
          </SelectTrigger>
          <SelectContent>
            {stages.map((stage) => (
              <SelectItem key={stage.id} value={stage.id}>
                {stage.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "deal.set":
    case "company.set":
    case "contact.set":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            value={String(params.field ?? "")}
            onChange={(e) => onChange("field", e.target.value)}
            placeholder="Champ (ex. priority)"
            aria-label="Champ à modifier"
          />
          <Input
            value={String(params.value ?? "")}
            onChange={(e) => onChange("value", e.target.value)}
            placeholder="Nouvelle valeur"
            aria-label="Nouvelle valeur"
          />
        </div>
      );

    case "activity.log":
      return (
        <Input
          value={String(params.content ?? "")}
          onChange={(e) => onChange("content", e.target.value)}
          placeholder="Note à écrire dans la timeline"
          aria-label="Contenu de la note"
        />
      );

    case "calendar.create_event":
      return (
        <p className="text-xs text-muted-foreground">
          Pousse vers l&apos;agenda la relance créée juste avant. À placer après une
          action « Créer une relance ».
        </p>
      );

    case "webhook.post":
      return (
        <p className="text-xs text-muted-foreground">
          Appelle les webhooks configurés dans Réglages → API &amp; webhooks.
        </p>
      );

    default:
      return null;
  }
}
