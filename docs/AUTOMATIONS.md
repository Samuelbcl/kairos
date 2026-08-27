# docs/AUTOMATIONS.md — Moteur d'automatisations

L'idée : reproduire — en beaucoup plus puissant et sans code — le réflexe que Samuel a déjà en Excel (« je mets *à relancer* → ça crée un événement agenda »), et le rendre configurable par n'importe quel utilisateur, y compris tes clients.

Une automatisation = **un déclencheur → des conditions → des actions**. Le tout stocké en JSON dans la table `automations`, exécuté par `lib/automations/engine.ts`.

---

## Anatomie

```jsonc
{
  "name": "Relance auto à la mise en 'À relancer'",
  "enabled": true,
  "trigger":  { "event": "deal.stage_changed", "to_stage": "À relancer" },
  "conditions": [
    { "field": "deal.priority", "op": "in", "value": ["normal", "high"] }
  ],
  "actions": [
    { "type": "task.create",           "params": { "title": "Relancer {{company.name}}", "due_in_days": 5, "remind_min": 60 } },
    { "type": "calendar.create_event", "params": { "from_task": true } },
    { "type": "email.send",            "params": { "template": "relance_1", "to": "{{company.email}}" } }
  ]
}
```

### Déclencheurs (`trigger.event`)
`contact.created` · `company.created` · `deal.created` · `deal.stage_changed` (avec `to_stage`) · `deal.stale` (inactif depuis N jours) · `task.created` · `task.completed` · `task.overdue`.

### Conditions (toutes doivent être vraies)
Opérateurs : `eq`, `neq`, `in`, `gt`, `lt`, `contains`, `is_empty`, `is_set`.
Champs : n'importe quel attribut de l'entité concernée (`deal.value`, `company.tags`, `contact.email`…).

### Actions disponibles
- `task.create` — crée une relance (`due_in_days`, `remind_min`, `assignee`).
- `calendar.create_event` — pousse vers l'agenda connecté (souvent `from_task: true`).
- `email.send` — via Resend ou la boîte connectée, avec template.
- `deal.move` — déplace vers une étape.
- `deal.set` / `company.set` / `contact.set` — met à jour un champ.
- `activity.log` — écrit une note dans la timeline.
- `webhook.post` — appelle une URL externe (pont vers Make/Zapier/n8n → tout).
- `notify` — notifie un membre dans l'app.

### Variables (templating)
`{{company.name}}`, `{{contact.first_name}}`, `{{deal.title}}`, `{{deal.value}}`, `{{user.full_name}}`, `{{today}}`… interpolées à l'exécution.

---

## Recettes prêtes à l'emploi (activables en 1 clic)

Ces automatisations sont proposées par défaut à la création d'un espace ; l'utilisateur les active/désactive sans rien configurer.

1. **Relance systématique** — *deal passé en « Contacté » → crée une relance à J+5 + événement agenda.* (le cœur du produit)
2. **Pas de réponse → seconde relance** — *task de relance terminée sans passage en « En discussion » → nouvelle relance à J+7.*
3. **Deal qui dort** — *aucune activité depuis 14 jours → notifie le propriétaire + crée une tâche.*
4. **Nouveau client** — *deal gagné → email de remerciement + webhook (pour déclencher la facturation ailleurs).*
5. **Accusé de contact** — *contact créé via formulaire → email de confirmation + tag « inbound ».*

---

## Exécution — `lib/automations/engine.ts`

```ts
// Appelé après chaque mutation pertinente (dans les Server Actions),
// ou par le cron pour les triggers temporels (deal.stale, task.overdue).
export async function runAutomations(event: DomainEvent, ctx: Ctx) {
  const rules = await getEnabledAutomations(ctx.workspaceId, event.type);
  for (const rule of rules) {
    if (!matchTrigger(rule.trigger, event)) continue;
    if (!evalConditions(rule.conditions, event.payload)) continue;
    for (const action of rule.actions) {
      try {
        await runAction(action, event.payload, ctx);
        await logRun(rule.id, 'success', { action: action.type });
      } catch (e) {
        await logRun(rule.id, 'error', { action: action.type, error: String(e) });
      }
    }
  }
}
```

**Garde-fous**
- Idempotence : une action `calendar.create_event` respecte `external_event_id` (pas de doublon).
- Anti-boucle : une action qui modifie une entité ne redéclenche pas la même règle (profondeur max = 1, ou flag `source: 'automation'`).
- Journalisation : tout passe dans `automation_runs` (visible dans l'UI, onglet « Journal »).
- Les triggers temporels (`deal.stale`, `task.overdue`) sont évalués par `/api/cron/reminders`.

---

## UI — RuleBuilder (`components/automations/RuleBuilder`)

Trois blocs empilés, langage naturel :

> **Quand** un deal passe en `[étape ▾]`
> **Si** `[champ ▾] [opérateur ▾] [valeur]` *(+ ajouter une condition)*
> **Alors** `[action ▾]` *(+ ajouter une action)*

Pas de JSON exposé à l'utilisateur. Aperçu en clair de la règle avant enregistrement, et bouton « Tester » qui simule sur un deal fictif.
