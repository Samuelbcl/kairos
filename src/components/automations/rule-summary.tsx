import {
  ACTION_LABELS,
  OPERATOR_LABELS,
  TRIGGER_LABELS,
  type Action,
  type Condition,
  type Trigger,
} from "@/lib/automations/types";

type Stage = { id: string; name: string };

/**
 * Rend une règle en français lisible. L'utilisateur ne voit jamais le JSON :
 * il lit « Quand… si… alors… », comme il l'aurait écrit.
 */
export function describeTrigger(trigger: Trigger, stages: Stage[]): string {
  const base = TRIGGER_LABELS[trigger.event] ?? trigger.event;

  if (trigger.event === "deal.stage_changed" && trigger.to_stage) {
    const stage = stages.find((s) => s.id === trigger.to_stage);
    return `Une opportunité passe en « ${stage?.name ?? trigger.to_stage} »`;
  }
  if (trigger.event === "deal.stale" && trigger.days) {
    return `Une opportunité dort depuis ${trigger.days} jours`;
  }
  return base;
}

export function describeCondition(condition: Condition): string {
  const operator = OPERATOR_LABELS[condition.op] ?? condition.op;
  const needsValue = condition.op !== "is_empty" && condition.op !== "is_set";
  const value = Array.isArray(condition.value)
    ? condition.value.join(", ")
    : String(condition.value ?? "");

  return needsValue
    ? `${condition.field} ${operator} « ${value} »`
    : `${condition.field} ${operator}`;
}

export function describeAction(action: Action, stages: Stage[]): string {
  const label = ACTION_LABELS[action.type] ?? action.type;
  const params = action.params ?? {};

  switch (action.type) {
    case "task.create": {
      const days = Number(params.due_in_days ?? 5);
      return `Créer une relance « ${params.title ?? "Relance"} » à J+${days}`;
    }
    case "deal.move": {
      const stage = stages.find((s) => s.id === params.stage_id);
      return `Déplacer vers « ${stage?.name ?? "une étape"} »`;
    }
    case "email.send":
      return `Envoyer un e-mail à ${params.to ?? "l'adresse de la fiche"}`;
    case "deal.set":
    case "company.set":
    case "contact.set":
      return `${label} : ${params.field ?? "champ"} = « ${params.value ?? ""} »`;
    case "activity.log":
      return `Écrire dans la timeline : « ${params.content ?? ""} »`;
    default:
      return label;
  }
}

export function RuleSummary({
  trigger,
  conditions,
  actions,
  stages,
}: {
  trigger: Trigger;
  conditions: Condition[];
  actions: Action[];
  stages: Stage[];
}) {
  return (
    <dl className="flex flex-col gap-1.5 text-sm">
      <div className="flex gap-2">
        <dt className="w-12 shrink-0 text-muted-foreground">Quand</dt>
        <dd className="min-w-0">{describeTrigger(trigger, stages)}</dd>
      </div>

      {conditions.length > 0 ? (
        <div className="flex gap-2">
          <dt className="w-12 shrink-0 text-muted-foreground">Si</dt>
          <dd className="min-w-0">
            {conditions.map((condition, i) => (
              <span key={`${condition.field}-${i}`} className="block">
                {describeCondition(condition)}
              </span>
            ))}
          </dd>
        </div>
      ) : null}

      <div className="flex gap-2">
        <dt className="w-12 shrink-0 text-muted-foreground">Alors</dt>
        <dd className="min-w-0">
          {actions.map((action, i) => (
            <span key={`${action.type}-${i}`} className="block">
              {describeAction(action, stages)}
            </span>
          ))}
        </dd>
      </div>
    </dl>
  );
}
