/**
 * Catalogue des événements webhook — partagé serveur et client.
 *
 * Volontairement séparé de `lib/webhooks.ts`, qui est marqué `server-only` :
 * l'interface de configuration a besoin des libellés, pas de la logique d'envoi.
 */

export const WEBHOOK_EVENTS = [
  "company.created",
  "contact.created",
  "deal.created",
  "deal.stage_changed",
  "deal.won",
  "deal.lost",
  "task.created",
  "task.completed",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const WEBHOOK_EVENT_LABELS: Record<WebhookEvent, string> = {
  "company.created": "Entreprise créée",
  "contact.created": "Contact créé",
  "deal.created": "Opportunité créée",
  "deal.stage_changed": "Opportunité changée d'étape",
  "deal.won": "Opportunité gagnée",
  "deal.lost": "Opportunité perdue",
  "task.created": "Relance créée",
  "task.completed": "Relance terminée",
};
