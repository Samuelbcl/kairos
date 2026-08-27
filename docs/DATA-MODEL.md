# docs/DATA-MODEL.md — Modèle de données

Vue d'ensemble lisible du schéma (`supabase/migrations/0001_init.sql`). Sert de référence quand on écrit les Server Actions et les composants.

## Carte des relations

```
auth.users ──1:1── profiles
     │
     └──*── workspace_members ──*── workspaces ─┐
                                                 │ (tout est scopé workspace_id)
   workspaces ──1:*── pipelines ──1:*── stages   │
   workspaces ──1:*── tags                        │
   workspaces ──1:*── custom_fields               │
   workspaces ──1:*── companies ──1:*── contacts  │
   workspaces ──1:*── deals  (→ company, contact, stage, pipeline)
   workspaces ──1:*── activities  (polymorphe : company | contact | deal)
   workspaces ──1:*── tasks       (→ company/contact/deal, sync agenda)
   workspaces ──1:*── automations ──1:*── automation_runs
   workspaces ──1:*── webhooks
   workspaces ──1:*── api_keys
   workspaces + user ──1:1── integrations (google | microsoft)
```

## Entités

**workspaces** — le tenant (= un client). Porte le `branding` (jsonb : accent, radius, mode, logo, nom), le `timezone` (défaut `Europe/Brussels`) et le `plan`. Créé automatiquement au signup.

**workspace_members** — qui a accès à quoi, avec un `role` (`owner` / `admin` / `member`). Clé de toute la RLS via `is_workspace_member()` et `is_workspace_admin()`.

**pipelines / stages** — un espace a au moins un pipeline (« Prospection ») et ses étapes. Chaque `stage` a un `name`, une `color` (personnalisable), une `position`, une `probability` (0–100 pour les prévisions), et les drapeaux `is_won` / `is_lost` qui pilotent le `status` du deal automatiquement.

**companies** — le compte (entreprise). C'est l'entité principale de ta prospection actuelle : `name`, `email`, `sector`, `city`, `tags[]`, `custom` (jsonb pour les champs personnalisés), `owner_id`, `source`. Recherche floue via index trigram sur `name`.

**contacts** — les personnes rattachées à une company (`company_id`). Peut rester vide au début (tu prospectes surtout des `info@`), à enrichir quand tu as un interlocuteur nommé.

**deals** — l'opportunité qui vit dans le pipeline : `title`, `value`, `stage_id`, `status`, `priority`, `expected_close`, `last_activity_at` (clé pour repérer les deals qui dorment). Le changement d'étape écrit une activité et recalcule le statut (trigger).

**activities** — la timeline, polymorphe (`subject_type` + `subject_id`). Types : `note`, `email`, `call`, `meeting`, `task`, `stage_change`, `system`. C'est l'historique lisible d'une fiche.

**tasks** — **l'objet central : la relance.** `title`, `kind` (`follow_up`…), `due_at`, `remind_at`, `done`, rattachements (`company_id` / `contact_id` / `deal_id`), `assignee_id`, et les champs de sync agenda (`calendar_provider`, `external_event_id`, `calendar_synced_at`) pour l'idempotence.

**integrations** — 1 ligne par user et par provider. Contient les **tokens OAuth chiffrés** (`access_token_enc`, `refresh_token_enc`), les `scopes`, `expires_at`, `calendar_id`. **Jamais lue côté client.**

**automations / automation_runs** — les règles « quand → si → alors » (jsonb) et leur journal d'exécution. Voir `docs/AUTOMATIONS.md`.

**webhooks / api_keys** — la connectivité ouverte. `webhooks` = POST signés HMAC vers l'extérieur ; `api_keys` = accès API (clé **hashée**, seul le `prefix` est affiché).

**tags / custom_fields** — la modularité par espace : catalogue de tags colorés, et définition de champs personnalisés dont les valeurs vivent dans la colonne `custom` (jsonb) des entités.

## Choix de conception à retenir

- **Company-first** : ton flux actuel est « une entreprise = une ligne ». On modélise donc company comme entité pivot, contact optionnel. Un deal peut exister sans contact nommé.
- **jsonb pour le sur-mesure** (`custom`, `branding`, `trigger/actions`) : on évite de multiplier les tables pour rester léger et modulable.
- **Idempotence agenda** via `external_event_id` : une tâche ⇄ un événement, jamais de doublon.
- **`last_activity_at` sur deals** : permet la détection « deal qui dort » sans requête coûteuse.
- **Tout scopé `workspace_id`** + RLS par appartenance : l'étanchéité multi-client est garantie au niveau base, pas seulement dans l'UI.
