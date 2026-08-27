/** Vocabulaire du moteur d'automatisations. Partagé serveur ↔ RuleBuilder. */

export const TRIGGER_EVENTS = [
  "company.created",
  "contact.created",
  "deal.created",
  "deal.stage_changed",
  "deal.stale",
  "task.created",
  "task.completed",
  "task.overdue",
] as const;

export type TriggerEvent = (typeof TRIGGER_EVENTS)[number];

export const TRIGGER_LABELS: Record<TriggerEvent, string> = {
  "company.created": "Une entreprise est créée",
  "contact.created": "Un contact est créé",
  "deal.created": "Une opportunité est créée",
  "deal.stage_changed": "Une opportunité change d'étape",
  "deal.stale": "Une opportunité dort depuis N jours",
  "task.created": "Une relance est créée",
  "task.completed": "Une relance est terminée",
  "task.overdue": "Une relance est en retard",
};

export const OPERATORS = [
  "eq",
  "neq",
  "in",
  "gt",
  "lt",
  "contains",
  "is_empty",
  "is_set",
] as const;

export type Operator = (typeof OPERATORS)[number];

export const OPERATOR_LABELS: Record<Operator, string> = {
  eq: "est égal à",
  neq: "est différent de",
  in: "fait partie de",
  gt: "est supérieur à",
  lt: "est inférieur à",
  contains: "contient",
  is_empty: "est vide",
  is_set: "est renseigné",
};

export const ACTION_TYPES = [
  "task.create",
  "calendar.create_event",
  "email.send",
  "deal.move",
  "deal.set",
  "company.set",
  "contact.set",
  "activity.log",
  "webhook.post",
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

export const ACTION_LABELS: Record<ActionType, string> = {
  "task.create": "Créer une relance",
  "calendar.create_event": "Pousser la relance vers l'agenda",
  "email.send": "Envoyer un e-mail",
  "deal.move": "Déplacer l'opportunité vers une étape",
  "deal.set": "Modifier un champ de l'opportunité",
  "company.set": "Modifier un champ de l'entreprise",
  "contact.set": "Modifier un champ du contact",
  "activity.log": "Écrire une note dans la timeline",
  "webhook.post": "Appeler une URL externe",
};

export type Trigger = {
  event: TriggerEvent;
  /** Pour deal.stage_changed : n'agit que vers cette étape. */
  to_stage?: string;
  /** Pour deal.stale : seuil d'inactivité. */
  days?: number;
};

export type Condition = {
  field: string;
  op: Operator;
  value?: unknown;
};

export type Action = {
  type: ActionType;
  params: Record<string, unknown>;
};

export type Rule = {
  id: string;
  name: string;
  enabled: boolean;
  trigger: Trigger;
  conditions: Condition[];
  actions: Action[];
};

/** Champs proposés dans le RuleBuilder, par entité. */
export const CONDITION_FIELDS = [
  { value: "company.name", label: "Entreprise · nom" },
  { value: "company.email", label: "Entreprise · e-mail" },
  { value: "company.sector", label: "Entreprise · secteur" },
  { value: "company.city", label: "Entreprise · ville" },
  { value: "company.tags", label: "Entreprise · tags" },
  { value: "contact.email", label: "Contact · e-mail" },
  { value: "contact.role_title", label: "Contact · fonction" },
  { value: "deal.title", label: "Opportunité · titre" },
  { value: "deal.value", label: "Opportunité · montant" },
  { value: "deal.priority", label: "Opportunité · priorité" },
  { value: "deal.status", label: "Opportunité · statut" },
  { value: "task.kind", label: "Relance · type" },
  { value: "task.priority", label: "Relance · priorité" },
] as const;
