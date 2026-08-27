# ROADMAP.md — Plan de build

Chaque phase se termine par un **critère de fin** clair : quand il est atteint, on déploie et on passe à la suite. On ne commence pas une phase avant que la précédente tourne.

---

## Phase 0 — Fondations (un projet vide qui tourne en prod)

**But :** avoir le squelette déployé, base de données prête, auth branchée.

- [ ] `create-next-app` (TS strict, Tailwind, App Router, src-dir, alias `@/*`).
- [ ] `shadcn init` + thème de base (voir `docs/DESIGN-SYSTEM.md`).
- [ ] Projet Supabase créé en `eu-central-1`. Exécuter `0001_init.sql`.
- [ ] `lib/supabase/{server,client,middleware}.ts` avec `@supabase/ssr`.
- [ ] Générer les types : `supabase gen types … > src/types/db.ts`.
- [ ] Layout applicatif : Sidebar + Topbar (coquille vide).
- [ ] Déploiement Vercel + variables d'env. La home affiche « Kairos » en ligne.

**Critère de fin :** l'URL Vercel s'ouvre, aucune erreur console, la connexion à Supabase répond.

---

## Phase 1 — Auth & multi-tenant

**But :** se connecter, atterrir dans son espace, RLS étanche.

- [ ] Page `/login` : email magic link + bouton Google.
- [ ] `/auth/callback` : échange de code, session en cookie.
- [ ] Middleware : redirige les non-connectés vers `/login`.
- [ ] Au signup, le trigger `handle_new_user` crée workspace + pipeline + étapes (déjà en SQL — vérifier).
- [ ] Sélecteur d'espace dans la Topbar (si l'user est dans plusieurs).
- [ ] Réglages → Membres : inviter par email, changer les rôles (owner/admin/member).
- [ ] **Test de fuite** : 2 comptes, 2 espaces → A ne voit rien de B (via RLS).

**Critère de fin :** je me connecte avec Google, je vois mon espace, un second compte est parfaitement isolé.

---

## Phase 2 — Cœur CRM

**But :** gérer comptes, contacts, deals ; encoder vite ; importer le tableur.

- [ ] Server Actions `contacts.ts`, `companies.ts`, `deals.ts` (CRUD, validées zod).
- [ ] Liste **Contacts** : table comptes + contacts, recherche (pg_trgm), filtres tags.
- [ ] **Fiche** `/contacts/[id]` : infos + **édition en ligne** + **timeline** (activities).
- [ ] **Pipeline** `/pipeline` : kanban (@dnd-kit), colonnes = `stages`, drag pour changer d'étape (optimistic UI + Server Action).
- [ ] **⌘K QuickAdd** (cmdk) : ajouter une entreprise/contact/deal/tâche depuis n'importe où.
- [ ] **Import CSV** : mapping colonnes → champs, dédoublonnage sur l'email, aperçu avant import. (Reprendre le CSV des 202.)
- [ ] Notes rapides sur une fiche → activité `note`.

**Critère de fin :** j'importe mes 202 entreprises, je les vois dans le kanban, je déplace une carte, j'édite une fiche sans rechargement.

---

## Phase 3 — Relances & Agenda (le cœur du produit)

**But :** ne plus jamais rater une relance ; sync Google Calendar.

- [ ] Objet **Task** (relance) : créer depuis une fiche/deal, avec `due_at` + `remind_at`.
- [ ] Vue **/today** : « À faire aujourd'hui », « En retard », « À venir ». Action « Terminer ».
- [ ] Détection deals qui dorment (`last_activity_at` > N jours) → suggestion de relance.
- [ ] **OAuth Google** : `/api/integrations/google` + callback, tokens **chiffrés** (`lib/crypto.ts`).
- [ ] `lib/integrations/calendar.ts` : `createEvent`, `updateEvent`, `deleteEvent` (idempotent via `external_event_id`).
- [ ] Créer/màj une tâche avec `due_at` → événement Google Calendar avec rappel. Terminer/supprimer → nettoie l'événement.
- [ ] Vercel Cron `/api/cron/refresh-tokens` (refresh OAuth) + `/api/cron/reminders`.
- [ ] Fuseau **Europe/Brussels** géré partout (date-fns-tz).

**Critère de fin :** je pose une relance à J+5 sur un prospect → l'événement apparaît dans mon Google Agenda avec rappel ; je la termine → l'événement disparaît.

---

## Phase 4 — Connectivité (ouvert à tout)

**But :** automations, webhooks, API, emails, Microsoft.

- [ ] **Moteur d'automatisations** (`lib/automations/engine.ts`) : triggers + conditions + actions (voir `docs/AUTOMATIONS.md`).
- [ ] UI **/automations** : RuleBuilder (« quand… si… alors… »), toggles, journal des exécutions.
- [ ] Recette par défaut activable en 1 clic : *« Statut → À relancer : crée un événement agenda + un rappel »* (l'équivalent moderne de ton bouton Excel).
- [ ] **Emails Resend** : templates de relance, envoi manuel + via automation. (Option : envoi via Gmail connecté.)
- [ ] **Webhooks sortants** signés (HMAC) sur les événements clés (`deal.stage_changed`, `task.created`…).
- [ ] **API REST** + clés API (lecture/écriture contacts, deals, tasks) pour Make/Zapier/n8n.
- [ ] **OAuth Microsoft** (Graph) : mêmes capacités calendrier que Google.

**Critère de fin :** une règle « passage en *À relancer* → événement agenda + email » fonctionne de bout en bout ; un webhook part vers une URL de test ; l'API répond avec une clé.

---

## Phase 5 — Polish, branding & prod

**But :** que ce soit beau, personnalisable, revendable.

- [ ] **Thème par espace** : couleur d'accent, rayon, logo, nom (branding jsonb → CSS vars). Aperçu live.
- [ ] Étapes de pipeline & couleurs éditables dans les réglages.
- [ ] Champs personnalisés (custom_fields) éditables + rendus sur les fiches.
- [ ] **Dashboard** : taux de réponse, valeur du pipeline par étape, relances de la semaine, activité.
- [ ] États vides soignés, squelettes de chargement, toasts, raccourcis clavier.
- [ ] Responsive complet + passe accessibilité (focus, contrastes, aria).
- [ ] Export & suppression de données (RGPD).
- [ ] Domaine, SEO minimal, page de connexion à la marque.

**Critère de fin :** je change la couleur et le logo d'un espace et toute l'UI suit ; le dashboard affiche des chiffres justes ; l'app est agréable sur mobile.

---

## Après le MVP (V2, à la demande réelle)

Sync agenda **bidirectionnelle** · séquences de relance multi-étapes · capture de leads (formulaire/email-to-CRM) · PWA installable · facturation **Stripe** pour vendre Kairos en SaaS · rapports avancés.
