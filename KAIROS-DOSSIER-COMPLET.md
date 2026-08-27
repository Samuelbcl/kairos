# KAIROS — Dossier de conception complet

> **CRM connecté, relance-first, white-label** — pour Biancola Studio, conçu pour être dupliqué et rebrandé pour des clients.

**Auteur :** Samuel — Biancola Studio · **Date :** 27/08/2026  
**Stack :** Next.js 15 (App Router, TS strict) · Tailwind + shadcn/ui · Supabase (Postgres + Auth + RLS, eu-central-1) · Vercel · Resend · Google Calendar / Microsoft Graph

Ce document réunit **tout le dossier en un seul fichier** : produit, architecture, schéma de base de données, design, intégrations, automatisations et modèle white-label. Il se lit de haut en bas, ou se dépose tel quel comme contexte unique dans Claude Code.


---

## Sommaire

1. [Vue d'ensemble & démarrage rapide](#partie-1)
2. [Cahier des charges produit](#partie-2)
3. [Fichier maître pour Claude Code](#partie-3)
4. [Plan de build (6 phases)](#partie-4)
5. [Modèle de données](#partie-5)
6. [Design system](#partie-6)
7. [Connectivité & intégrations](#partie-7)
8. [Moteur d'automatisations](#partie-8)
9. [White-label : dupliquer pour un client](#partie-9)
10. [Schéma Supabase — 0001_init.sql](#partie-10)
11. [Seed de démo — 0002_seed.sql](#partie-11)
12. [Variables d'environnement — .env.example](#partie-12)
13. [Dépendances — package.json](#partie-13)


---

<a id="partie-1"></a>

# Partie 1/13 — Vue d'ensemble & démarrage rapide

<sub>Fichier source : `README.md`</sub>

# Kairos — le CRM connecté de Biancola Studio

> **Kairos** (καιρός) : « le bon moment ». Un CRM pensé autour d'une seule obsession — ne jamais rater une relance — dans une interface moderne, rapide et agréable, connectée à tout ton écosystème (Google, Microsoft, et n'importe quelle app via webhooks).

Ce dépôt est un **produit white-label**. Tu l'utilises d'abord pour Biancola Studio, puis tu le dupliques / rebrandes pour tes clients (notaires, agences immo, TPE/PME) — chaque client a son espace, son logo, ses couleurs, son pipeline.

---

## Ce que contient ce dossier

| Fichier | Rôle |
|---|---|
| `BRIEF.md` | Cahier des charges produit : vision, personas, features MVP, concurrents, business model white-label, métriques, risques |
| `CLAUDE.md` | Fichier maître pour Claude Code : stack, arborescence, conventions, ordre d'implémentation, garde-fous, Definition of Done |
| `ROADMAP.md` | Plan de build en 6 phases, chaque phase avec checklist actionnable et critère de fin |
| `supabase/migrations/0001_init.sql` | Schéma Postgres complet : multi-tenant, RLS, index, triggers, fonctions |
| `supabase/migrations/0002_seed.sql` | Données de démo (workspace Biancola + pipeline + quelques comptes) |
| `docs/DATA-MODEL.md` | Modèle de données détaillé, entité par entité |
| `docs/DESIGN-SYSTEM.md` | Direction artistique « ludique mais pro », tokens, thème personnalisable, composants, icônes |
| `docs/INTEGRATIONS.md` | Google Calendar / Outlook / Gmail / webhooks / API — flux OAuth et sync |
| `docs/AUTOMATIONS.md` | Le moteur d'automatisations (le « bouton Excel → Agenda », en beaucoup mieux) |
| `docs/WHITE-LABEL.md` | Comment dupliquer / rebrander pour un nouveau client |
| `.env.example` | Toutes les variables d'environnement nécessaires |
| `package.json` | Dépendances cibles (placeholder à compléter au scaffold) |

---

## Démarrage rapide

> Prérequis : Node.js ≥ 20, un compte Supabase, un compte Vercel, un compte Resend. Google Cloud + Microsoft Entra pour les intégrations (optionnel au début).

```bash
# 1. Scaffold Next.js (fait par Claude Code en Phase 0)
npx create-next-app@latest kairos --ts --tailwind --app --src-dir --import-alias "@/*"
cd kairos

# 2. Dépendances principales
npm i @supabase/supabase-js @supabase/ssr zod react-hook-form @hookform/resolvers \
      lucide-react date-fns @tanstack/react-query sonner cmdk
npx shadcn@latest init

# 3. Variables d'environnement
cp .env.example .env.local   # puis remplis les valeurs

# 4. Base de données
#    Dans le dashboard Supabase → SQL Editor → colle 0001_init.sql puis 0002_seed.sql
#    (ou via CLI : supabase db push)

# 5. Lancer
npm run dev        # http://localhost:3000
```

Ensuite tu ouvres `CLAUDE.md` dans VS Code et tu demandes à Claude Code d'attaquer la **Phase 1** de `ROADMAP.md`.

---

## Principe de travail

Ce dossier est fait pour être **déroulé phase par phase** par Claude Code. On ne code pas tout d'un coup : chaque phase de `ROADMAP.md` a un critère de fin clair (« ça tourne, c'est déployé, on passe à la suite »). Mindset indie hacker solo : livrable vite, zéro sur-ingénierie, on itère.


---

<a id="partie-2"></a>

# Partie 2/13 — Cahier des charges produit

<sub>Fichier source : `BRIEF.md`</sub>

# BRIEF.md — Cahier des charges produit

## One-liner

**Kairos, c'est le CRM qui te force à faire tes relances au bon moment — sans friction, et connecté à ton agenda.**

## Vision

La plupart des CRM sont soit trop lourds (Salesforce, HubSpot : usines à gaz pour une TPE), soit trop plats (un Google Sheet qui ne relance personne). Kairos vise le point mort entre les deux : la légèreté d'un tableur, la puissance d'un vrai CRM, et une couche de **connectivité native** (agenda, mail, webhooks) qui automatise ce que tout le monde fait à la main.

Le fil rouge du produit : **la relance**. Un prospect contacté sans réponse est de l'argent qui dort. Kairos rend la relance tellement simple et tellement bien rappelée qu'on ne l'oublie plus jamais.

## Le problème (concret)

Samuel, en prospection cold email pour Biancola Studio, gère aujourd'hui ~200 entreprises dans un tableur. Douleurs réelles observées :

- **Les relances passent à la trappe.** Un statut « envoyé – sans réponse » reste figé ; rien ne rappelle qu'il faut relancer à J+5.
- **L'encodage est pénible.** Ajouter un prospect, changer un statut, noter une réponse : trop de clics, pas d'endroit unique.
- **Les silos.** Le tableur d'un côté, l'agenda de l'autre, la boîte mail encore ailleurs. Samuel a bricolé un bouton Excel « à relancer → Google Calendar », mais c'est fragile et non réplicable.
- **Aucune visibilité.** Combien de contactés, quel taux de réponse, quels dossiers chauds ? Invisible dans un tableur.
- **Non duplicable.** Impossible de proposer proprement le même outil à un client.

Coût du problème : sur 200 prospects, un taux de réponse qui passe de 3 % à 8 % grâce à des relances systématiques, c'est **10 rendez-vous au lieu de 6**. Pour un studio solo, c'est la différence entre un mois creux et un mois plein.

## Solution & proposition de valeur unique

Un CRM B2B léger, **relance-first**, où :

1. **Encoder est instantané** — ajout via une barre de commande (⌘K), édition en ligne, import CSV en un glisser-déposer, et à terme capture depuis un email.
2. **Chaque relance devient un vrai rappel** — une date de relance crée automatiquement un événement dans ton Google Calendar / Outlook, avec rappel, et peut déclencher un email de suivi.
3. **Tout est connecté** — intégrations natives Google & Microsoft, plus un moteur de webhooks et une API pour brancher n'importe quelle app (Make, Zapier, n8n…).
4. **C'est modulable et à ta marque** — pipeline, étapes, couleurs, champs personnalisés, logo : chaque espace se configure. Duplicable pour tes clients.
5. **C'est agréable** — rapide, fluide, moderne. On a *envie* d'y aller.

**UVP en une phrase :** *le seul CRM assez simple pour une TPE, mais assez connecté pour ne plus jamais rater une relance.*

## Personas

**1. Samuel — le solo qui prospecte (utilisateur primaire).**
Développeur-fondateur, fait sa propre prospection cold email. Besoin : encoder vite, être rappelé de relancer, voir ses chiffres, ne pas y passer sa vie. Sensible au design et à la vitesse.

**2. La TPE cliente — l'artisan / indépendant qui reçoit Kairos en marque blanche.**
Menuisier, notaire, agent immo. Peu à l'aise avec les outils complexes. Besoin : un carnet de contacts + relances qui « juste marche », relié à l'agenda qu'il utilise déjà (souvent Outlook/Google). Ne lira jamais une doc.

**3. L'assistant·e / secrétaire — le co-utilisateur dans un cabinet.**
Encode et suit les dossiers pour le compte du patron. Besoin : rôles et permissions clairs, timeline lisible, rien qui casse.

## Fonctionnalités — MVP priorisé (MoSCoW)

### Must (V1 — sans ça, pas de produit)
- Auth (email + Google) et création automatique d'un espace de travail.
- **Comptes (entreprises)** et **contacts (personnes)** avec fiche détaillée + timeline d'activité.
- **Pipeline visuel** (kanban) avec étapes et couleurs personnalisables ; glisser-déposer.
- **Relances / tâches** avec date d'échéance et vue « À faire aujourd'hui / en retard ».
- **Sync Google Calendar** : une relance crée/maj un événement (one-way CRM → Agenda) avec rappel.
- Ajout ultra-rapide (barre ⌘K) + édition en ligne.
- **Import CSV** (reprise du tableur existant).
- Recherche globale.
- Multi-tenant + RLS (chaque espace est étanche).

### Should (V1.1)
- **Sync Microsoft Outlook / 365** (mêmes capacités que Google).
- **Moteur d'automatisations** : règles « quand X → faire Y » (voir `docs/AUTOMATIONS.md`).
- **Emails de relance** via Resend (+ templates) et/ou envoi via Gmail connecté.
- **Champs personnalisés** par espace.
- **Thème & branding** par espace (logo, couleur d'accent, nom).
- Tableau de bord (taux de réponse, pipeline, activité).
- **Webhooks sortants** + API REST (connecter n'importe quelle app).

### Could (V2)
- Sync **bidirectionnelle** agenda (événements agenda ↔ CRM).
- Capture de leads : email-to-CRM, formulaire web, extension navigateur.
- Séquences de relance multi-étapes (cadences).
- Rapports avancés & objectifs d'équipe.
- App mobile PWA installable.
- Facturation Stripe pour vendre Kairos en SaaS.

### Won't (hors périmètre pour l'instant)
- Marketing automation de masse, scoring IA prédictif, téléphonie intégrée.

## Parcours utilisateur principal (le « golden path »)

1. Samuel se connecte avec Google → son espace « Biancola Studio » existe déjà (créé au signup).
2. Il importe son CSV de 200 entreprises → elles apparaissent dans la colonne **Contacté**.
3. Il connecte Google Calendar en un clic (OAuth).
4. Sur une fiche, il fixe **Relance : dans 5 jours** → un événement « Relancer Menuiserie Dupont » apparaît dans son agenda avec rappel.
5. À J+5, la vue **Aujourd'hui** liste la relance. Il clique **Relancer** → un email de suivi pré-rempli s'ouvre (ou part via automation), la date de dernière activité se met à jour.
6. Le prospect répond → Samuel glisse la carte vers **En discussion** → le tableau de bord voit le taux de réponse grimper.
7. Deal gagné → carte vers **Client**. Fin du cycle.

## Positionnement vs concurrents (vrais acteurs du marché)

- **Pipedrive** — la référence pipeline pour PME. Kairos est plus léger, plus joli, et *natif relance + agenda* dès le premier écran, sans le prix par siège.
- **Folk** — CRM « humain » moderne et élégant, très orienté relationnel/agence. Inspiration design forte ; Kairos se différencie par l'automatisation relance→agenda et le white-label pour revendre.
- **Attio** — data-driven, flexible, superbe UI. Puissant mais orienté équipes tech/VC. Kairos vise la TPE non-technique.
- **HubSpot (free)** — gratuit mais lourd et poussant à l'upsell. Kairos = zéro courbe d'apprentissage.
- **Notion / Airtable + Google Sheet** — ce que les gens utilisent faute de mieux. Kairos apporte les relances automatiques et les rappels que ces outils n'ont pas nativement.

**Angle unique de Biancola :** un CRM *revendable en marque blanche* aux clients du studio — ni Pipedrive ni Folk ne se positionnent là pour un intégrateur solo.

## Modèle économique (white-label)

- **Usage interne** : gratuit (c'est ton outil).
- **Revente client** : deux options, détaillées dans `docs/WHITE-LABEL.md` —
  - *SaaS mutualisé* : chaque client = un espace (workspace) sur ton déploiement unique. Tu factures un abonnement mensuel (ex. 19–49 €/mois selon features), marge quasi nette (coûts Supabase/Vercel/Resend mutualisés).
  - *Instance dédiée* : pour un client exigeant (notaire, données sensibles), tu forkes et déploies un Supabase + Vercel dédié. Setup one-shot + maintenance.
- **Add-ons facturables** : import & reprise de données, connecteurs sur-mesure (leur logiciel métier via webhook), personnalisation de pipeline.

## Métriques de succès

- **North Star : nombre de relances effectuées à temps / semaine.** C'est ça qui crée de la valeur.
- Secondaires : taux de réponse (répondu / contacté), temps médian d'encodage d'un prospect (< 15 s visé), nombre d'espaces actifs (adoption white-label), % de relances synchronisées à un agenda.

## Risques & angles morts

- **Tokens OAuth = données sensibles.** Chiffrer au repos, scopes minimaux, refresh géré proprement. Ne jamais logger un token. (voir `docs/INTEGRATIONS.md`).
- **RGPD.** Contacts = données personnelles. Hébergement UE (Supabase `eu-central-1`), RLS strict, export/suppression sur demande, registre des traitements si revente. Pour un notaire, prudence renforcée.
- **Sync agenda = source de bugs classiques** (doublons, fuseaux, événements orphelins). Démarrer en one-way, idempotent (un `external_event_id` par tâche), tester les fuseaux (Europe/Brussels).
- **Sur-ingénierie du white-label.** Ne pas construire le multi-tenant parfait avant d'avoir un seul client payant. Le schéma est prêt ; l'UI d'admin white-label attend la demande réelle.
- **Scope creep « connecté à tout ».** MVP = Google + webhooks. Le reste (Microsoft, séquences, bidirectionnel) est explicitement repoussé pour livrer vite.


---

<a id="partie-3"></a>

# Partie 3/13 — Fichier maître pour Claude Code

<sub>Fichier source : `CLAUDE.md`</sub>

# CLAUDE.md — Fichier maître (à lire en premier par Claude Code)

## Le projet en 4 lignes

**Kairos** est un CRM B2B web, multi-tenant et white-label, orienté « relance ». Chaque espace (workspace) gère comptes, contacts, deals dans un pipeline visuel, avec des tâches de relance qui se synchronisent nativement au calendrier (Google d'abord, Microsoft ensuite) et un moteur d'automatisations/webhooks pour connecter n'importe quelle app. UI en français, moderne, rapide et soignée. Premier utilisateur : Biancola Studio ; le produit est conçu pour être dupliqué/rebrandé pour des clients.

## Stack (imposée — ne pas dévier sans justification d'une ligne)

- **Next.js 15** (App Router, Server Components par défaut) + **TypeScript strict**
- **Tailwind CSS** + **shadcn/ui** (composants) + **lucide-react** (icônes)
- **Supabase** : Postgres + Auth + Storage + **RLS**, région **eu-central-1**
- **@supabase/ssr** pour l'auth côté serveur (cookies), pas l'ancien auth-helpers
- **React Query** (@tanstack/react-query) pour le cache client ; Server Actions pour les mutations
- **zod** + **react-hook-form** pour les formulaires et la validation
- **date-fns** (fuseau **Europe/Brussels**), **sonner** (toasts), **cmdk** (barre ⌘K), **@dnd-kit** (drag & drop kanban)
- **Resend** (emails transactionnels)
- **Vercel** (hébergement + Cron Jobs pour les rappels/refresh tokens)
- Intégrations : **Google APIs** (Calendar, Gmail) et **Microsoft Graph** (Outlook) via OAuth 2.0

## Arborescence cible

```
kairos/
├── src/
│   ├── app/
│   │   ├── (marketing)/               # landing publique (optionnel)
│   │   │   └── page.tsx
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── auth/callback/route.ts # échange code OAuth Supabase
│   │   ├── (app)/                     # zone connectée, layout avec sidebar
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx               # Dashboard
│   │   │   ├── pipeline/page.tsx      # Kanban
│   │   │   ├── contacts/page.tsx      # Liste comptes+contacts
│   │   │   ├── contacts/[id]/page.tsx # Fiche
│   │   │   ├── today/page.tsx         # Relances du jour / en retard
│   │   │   ├── automations/page.tsx
│   │   │   └── settings/
│   │   │       ├── workspace/page.tsx # branding, thème, pipeline, champs
│   │   │       ├── integrations/page.tsx
│   │   │       ├── members/page.tsx
│   │   │       └── api/page.tsx       # clés API & webhooks
│   │   ├── api/
│   │   │   ├── integrations/google/route.ts     # OAuth start
│   │   │   ├── integrations/google/callback/route.ts
│   │   │   ├── integrations/microsoft/route.ts
│   │   │   ├── webhooks/[id]/route.ts            # réception entrante (optionnel)
│   │   │   └── cron/
│   │   │       ├── reminders/route.ts            # Vercel Cron : rappels
│   │   │       └── refresh-tokens/route.ts       # Vercel Cron : refresh OAuth
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                        # shadcn
│   │   ├── kanban/                    # Board, Column, DealCard
│   │   ├── contacts/                  # ContactSheet, InlineEdit, Timeline
│   │   ├── command/                   # QuickAdd (⌘K)
│   │   ├── automations/              # RuleBuilder
│   │   └── shell/                     # Sidebar, Topbar, ThemeProvider
│   ├── lib/
│   │   ├── supabase/                  # server.ts, client.ts, middleware.ts
│   │   ├── integrations/              # google.ts, microsoft.ts, calendar.ts
│   │   ├── automations/               # engine.ts, triggers.ts, actions.ts
│   │   ├── crypto.ts                  # chiffrement des tokens
│   │   ├── validators/                # schémas zod par entité
│   │   └── utils.ts
│   ├── server/
│   │   └── actions/                   # Server Actions : contacts.ts, deals.ts, tasks.ts…
│   ├── types/
│   │   └── db.ts                      # types générés Supabase
│   └── config/
│       └── theme.ts                   # tokens & thème par défaut
├── supabase/
│   └── migrations/                    # 0001_init.sql, 0002_seed.sql, …
├── .env.local
└── (fichiers de ce dossier : BRIEF.md, ROADMAP.md, docs/…)
```

## Conventions

- **Nommage** : fichiers `kebab-case`, composants React `PascalCase`, fonctions/variables `camelCase`, tables & colonnes SQL `snake_case`.
- **Composants** : Server Components par défaut. `"use client"` uniquement quand il y a état/interaction (kanban, ⌘K, formulaires). Un composant = un fichier.
- **Data** : lecture via Server Components (Supabase server client) ; écriture via **Server Actions** typées, validées par zod, qui renvoient `{ ok, data?, error? }`. Cache client React Query seulement pour les vues très interactives.
- **Sécurité d'abord** : jamais de `service_role` côté client. Toute requête passe par RLS. Le `service_role` n'est utilisé que dans les routes serveur système (cron, webhooks).
- **UI en français** ; identifiants de code en anglais. Copy soignée, ton pro et clair (voir `docs/DESIGN-SYSTEM.md`, section écriture).
- **Icônes** : lucide-react, avec parcimonie, jamais d'emoji dans l'UII.
- **Commits** : Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`…).
- **Erreurs** : jamais silencieuses. Toast utilisateur clair + log serveur. Les messages d'erreur disent quoi faire, pas juste « une erreur est survenue ».

## Variables d'environnement (voir `.env.example`)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY`, `TOKEN_ENCRYPTION_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `CRON_SECRET`.

## Commandes clés

```bash
npm run dev            # dev local
npm run build          # build prod
npm run lint           # eslint
npx supabase db push   # applique les migrations (ou coller dans SQL Editor)
npx supabase gen types typescript --linked > src/types/db.ts   # types DB
vercel                 # déploiement
```

## Ordre d'implémentation (résumé — détail dans ROADMAP.md)

0. Setup : Next.js + Tailwind + shadcn + Supabase branché + déploiement vide qui tourne.
1. Auth + multi-tenant : login Google/email, création workspace au signup, RLS vérifiée.
2. Cœur CRM : comptes, contacts, deals, pipeline kanban, timeline, ⌘K, import CSV.
3. Relances : tâches, vue « Aujourd'hui », **sync Google Calendar** one-way.
4. Connectivité : automations, webhooks, API, emails Resend, Microsoft.
5. Polish : thème/branding par espace, dashboard, responsive, edge cases, prod.

## Garde-fous (ce qu'il ne faut PAS faire)

- Ne **pas** exposer `SUPABASE_SERVICE_ROLE_KEY` côté client, ni dans un Client Component.
- Ne **pas** stocker de token OAuth en clair : passer par `lib/crypto.ts` (AES-GCM, clé = `TOKEN_ENCRYPTION_KEY`).
- Ne **pas** écrire une requête qui contourne RLS « pour aller plus vite ». Si RLS gêne, c'est la policy qu'on corrige.
- Ne **pas** construire la sync bidirectionnelle agenda en MVP (bugs de doublons/fuseaux). One-way d'abord, idempotent via `external_event_id`.
- Ne **pas** hardcoder les étapes de pipeline : elles viennent de la table `stages` (personnalisables).
- Ne **pas** mettre d'emoji dans l'interface. Icônes Lucide uniquement.
- Ne **pas** sur-concevoir : pas de facturation Stripe, pas d'app mobile, pas d'IA tant que le MVP n'est pas solide.

## Definition of Done (par feature)

- [ ] Fonctionne avec RLS active (testé avec 2 workspaces distincts : aucune fuite).
- [ ] Validé par zod côté serveur (pas seulement côté client).
- [ ] États gérés : chargement, vide, erreur (avec copy utile).
- [ ] Responsive (utilisable sur mobile).
- [ ] Accessible : focus visible au clavier, contrastes AA, `aria-label` sur les icônes seules.
- [ ] Aucune clé secrète côté client ; aucun token loggé.
- [ ] Copy en français, ton cohérent.


---

<a id="partie-4"></a>

# Partie 4/13 — Plan de build (6 phases)

<sub>Fichier source : `ROADMAP.md`</sub>

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


---

<a id="partie-5"></a>

# Partie 5/13 — Modèle de données

<sub>Fichier source : `docs/DATA-MODEL.md`</sub>

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


---

<a id="partie-6"></a>

# Partie 6/13 — Design system

<sub>Fichier source : `docs/DESIGN-SYSTEM.md`</sub>

# docs/DESIGN-SYSTEM.md — Design system

## Le brief en une phrase

**Pro, rapide, moderne — agréable au point qu'on ait envie d'y aller.** Le « ludique » ne passe PAS par des emojis ou des couleurs criardes : il passe par la fluidité, la vitesse, des micro-interactions satisfaisantes et une interface qui respire. On vise le niveau de finition d'Attio, Folk et Linear.

## Références (ce qu'on emprunte à chacune)

- **Linear** — vitesse ressentie, raccourcis clavier partout, transitions courtes et nettes, densité maîtrisée.
- **Attio** — tables élégantes, données lisibles, sobriété premium.
- **Folk** — chaleur, rondeur, côté « humain » d'un CRM relationnel. Fiches contact agréables.
- **Pipedrive** — clarté du kanban : on comprend son pipeline en un coup d'œil.
- **Notion** — édition en ligne fluide, tout se modifie là où on le lit.

## Direction

Interface **claire par défaut** (mode sombre disponible), beaucoup de blanc, une **seule couleur d'accent** forte (personnalisable par espace), typographie soignée, coins arrondis, ombres douces et discrètes. Le mouvement est bref et fonctionnel (120–200 ms), jamais décoratif. La « joie » vient de : un drag de carte qui suit le doigt, un ⌘K instantané, un toast propre, un état vide qui donne envie de cliquer.

**Le geste signature :** le **⌘K QuickAdd**. Où qu'on soit, une frappe ouvre une barre de commande pour tout créer (entreprise, contact, deal, relance) en quelques secondes. C'est ça, « l'encodage hyper facile ».

## Tokens (thème par défaut — surchargés par `workspace.branding`)

```css
:root {
  /* Neutres (zinc/slate) */
  --background: #FFFFFF;
  --surface:    #FAFAFA;
  --card:       #FFFFFF;
  --border:     #E7E7EA;
  --muted:      #6B7280;
  --foreground: #18181B;

  /* Accent — personnalisable par espace (défaut indigo) */
  --accent:      #4F46E5;
  --accent-fg:   #FFFFFF;
  --accent-soft: #EEF0FF;

  /* Sémantique */
  --success: #16A34A;
  --warning: #D97706;
  --danger:  #DC2626;
  --info:    #2563EB;

  /* Forme & mouvement */
  --radius:  0.75rem;         /* personnalisable */
  --shadow:  0 1px 2px rgba(16,24,40,.04), 0 4px 12px rgba(16,24,40,.06);
  --ease:    cubic-bezier(.22,1,.36,1);
  --dur:     160ms;
}
:root[data-theme="dark"] {
  --background:#0B0B0F; --surface:#111114; --card:#16161B; --border:#26262C;
  --muted:#9A9AA5; --foreground:#F4F4F5; --accent-soft:#1B1B44;
}
```

### Personnalisation par espace (white-label)

`workspaces.branding` (jsonb) → injecté en CSS variables dans le `ThemeProvider` :

```ts
// components/shell/ThemeProvider.tsx (esquisse)
const { accent, radius, mode, logo_url, brand_name } = workspace.branding;
style = { ['--accent']: accent, ['--radius']: radius };
document.documentElement.dataset.theme = mode; // 'light' | 'dark'
```

L'écran **Réglages → Apparence** permet de choisir : couleur d'accent (palette + hex libre), arrondi (net / doux / rond), mode clair/sombre, logo, nom affiché. Les **couleurs des boutons** suivent l'accent ; les **couleurs d'étapes** du pipeline sont éditables une par une (champ `stages.color`). Aperçu live avant enregistrement.

## Typographie

- **Interface & corps** : `Inter` (ou `Geist Sans`) — neutre, lisible, moderne.
- **Titres / chiffres clés (dashboard)** : `Geist` en poids 600–700, ou `Inter` tight. Option : une display plus caractérielle (`General Sans`) réservée aux gros chiffres du dashboard.
- **Données / montants** : variante tabulaire (`font-variant-numeric: tabular-nums`) pour aligner les colonnes.
- Échelle : 12 / 13 / 14 (base UI) / 16 / 20 / 24 / 32 (chiffres dashboard). Interlignage généreux.

## Iconographie

**lucide-react uniquement. Zéro emoji dans l'UI.** Icônes à 1.5px de trait, taille 16–18px dans les contrôles, alignées au texte. Toujours un `aria-label` quand l'icône est seule.

Correspondances utiles : `Building2` (entreprise), `User` (contact), `Handshake`/`Target` (deal), `CalendarClock` (relance), `Bell` (rappel), `Plug`/`Zap` (intégrations & automations), `Search`, `Command` (⌘K), `Filter`, `MoreHorizontal`, `Check`, `TrendingUp` (dashboard).

## Composants clés (au-dessus de shadcn/ui)

- **Sidebar** : navigation (Dashboard, Pipeline, Contacts, Aujourd'hui, Automations, Réglages) + sélecteur d'espace + logo du branding.
- **Topbar** : recherche globale, bouton ⌘K, avatar/menu.
- **KanbanBoard** : colonnes = étapes (couleur = `stage.color`), cartes deals draggables (@dnd-kit), compteur + total valeur par colonne, drag fluide avec placeholder.
- **DealCard** : nom du compte, montant (tabular), pastille priorité, badge relance en retard (point coloré, pas d'emoji), pastilles de tags.
- **ContactSheet / fiche** : en-tête + timeline verticale (activities), édition en ligne (clic = champ éditable, Enter = save), bloc « Relances » latéral.
- **QuickAdd (⌘K)** : cmdk, recherche + création rapide, actions contextuelles.
- **TaskRow** (vue Aujourd'hui) : échéance relative (« il y a 2 j »), rattachement, boutons « Terminer » / « Reporter » / « Relancer ».
- **EmptyState** : icône fine + une phrase claire + un bouton d'action (jamais une page vide).

## Mouvement (discipline)

Transitions 120–200 ms, `--ease`. On anime : ouverture de sheet/dialog (fade+scale léger), drag de carte, apparition de toast, changement d'étape (petit « settle »). On **n'anime pas** : les chargements de liste (préférer des squelettes), les hovers de texte, tout ce qui se répète beaucoup. `prefers-reduced-motion` respecté.

## Écriture (la copy fait 50 % du « pro »)

- **Français, ton clair et direct**, jamais infantilisant, jamais d'emoji.
- Les **boutons disent l'action** : « Ajouter un contact », « Programmer la relance », « Connecter Google Agenda » — pas « Valider »/« Soumettre ».
- Le mot d'une action reste le même partout : bouton « Envoyer » → toast « Envoyé ».
- **États vides = invitations** : « Aucune relance en retard. Tu es à jour. » / « Ajoute ton premier prospect avec ⌘K. »
- **Erreurs = solutions** : « Impossible de créer l'événement : reconnecte Google Agenda dans Réglages → Intégrations. » Jamais « une erreur est survenue ».
- Nombres et dates à la belge/FR : `1 250 €`, `mar. 3 juin`, échéances relatives (« dans 5 jours », « il y a 2 jours »).

## Le « ludique », proprement dosé (optionnel, désactivable)

Pour garder l'énergie sans tomber dans le gadget, une couche *momentum* discrète, présentée comme une métrique pro (pas comme un jeu) :
- Un petit indicateur **« Relances cette semaine »** avec une barre de progression vers un objectif que l'utilisateur fixe.
- Une **série de jours actifs** affichée sobrement dans le dashboard (icône `Flame` fine, un chiffre — pas de confettis, pas de badge coloré).
- Micro-satisfaction : quand on termine la dernière relance du jour, la vue « Aujourd'hui » affiche un état vide valorisant (« Tout est à jour »), pas une animation tape-à-l'œil.

Tout ça est **désactivable** par espace (certains clients notaires n'en voudront pas). C'est un réglage, pas le cœur.


---

<a id="partie-7"></a>

# Partie 7/13 — Connectivité & intégrations

<sub>Fichier source : `docs/INTEGRATIONS.md`</sub>

# docs/INTEGRATIONS.md — Connectivité

Kairos est un CRM **connecté**. Trois niveaux, du plus natif au plus ouvert :

1. **Natif** : Google (Calendar, Gmail) et Microsoft (Outlook/Graph) via OAuth.
2. **Moteur** : automatisations internes (voir `docs/AUTOMATIONS.md`).
3. **Ouvert à tout** : webhooks sortants + API REST → Make, Zapier, n8n, ou le logiciel métier d'un client.

---

## 1. Principe de la sync calendrier (le remplaçant de ton bouton Excel)

Aujourd'hui, dans ton tableur : tu mets un prospect en « à relancer », tu cliques un bouton, ça crée un événement Google Calendar. Dans Kairos, c'est le même geste — mais natif, fiable et réplicable pour tes clients.

**La règle d'or : une tâche (relance) ⇄ un événement agenda, liés par `external_event_id`.**
Cette idempotence évite le bug classique des doublons.

```
Tâche créée avec due_at  ─┐
Tâche déplacée (due_at)   ├─►  calendar.upsertEvent(task)  ─►  Google/MS event
Tâche terminée/supprimée ─┘                                     (créé | mis à jour | supprimé)
```

- **Créer** une tâche avec `due_at` → `createEvent` → on stocke `external_event_id`, `calendar_provider`, `calendar_synced_at`.
- **Modifier** `due_at`/titre → `updateEvent(external_event_id)`.
- **Terminer / supprimer** → `deleteEvent(external_event_id)` puis on vide les champs de sync.
- Rappel : on passe `remind_at` en `reminders.overrides` de l'événement.
- **MVP = one-way** (Kairos → Agenda). Le two-way (agenda → Kairos) est en V2, plus délicat (fuseaux, boucles).

### Esquisse `lib/integrations/calendar.ts`

```ts
// Provider-agnostic : route vers Google ou Microsoft selon l'intégration.
export async function upsertTaskEvent(task: Task, integ: Integration) {
  const payload = toEventPayload(task, integ.timezone); // 'Europe/Brussels'
  if (integ.provider === 'google') return googleUpsert(task, integ, payload);
  return microsoftUpsert(task, integ, payload);
}

function toEventPayload(task: Task, tz: string) {
  const start = task.due_at;                       // ISO
  const end   = addMinutes(new Date(start), 30);
  const remindMin = task.remind_at
    ? differenceInMinutes(new Date(start), new Date(task.remind_at))
    : 30;
  return {
    summary: task.title,                            // ex: « Relancer Boucha Group »
    description: `Relance Kairos · ${appUrl}/contacts/${task.company_id}`,
    start: { dateTime: start, timeZone: tz },
    end:   { dateTime: end.toISOString(), timeZone: tz },
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: remindMin }] },
  };
}
```

---

## 2. OAuth — flux et sécurité

**Scopes minimaux** (principe du moindre privilège) :
- Google : `https://www.googleapis.com/auth/calendar.events` (+ `gmail.send` seulement si envoi via Gmail activé).
- Microsoft : `Calendars.ReadWrite`, `offline_access` (+ `Mail.Send` si besoin).

**Flux** (`/api/integrations/google` → Google → `/api/integrations/google/callback`) :
1. On génère un `state` signé (contient `workspace_id` + `user_id`) et on redirige vers l'écran de consentement.
2. Au retour, on échange le `code` contre `access_token` + `refresh_token`.
3. On **chiffre** les tokens (`lib/crypto.ts`, AES-256-GCM, clé `TOKEN_ENCRYPTION_KEY`) et on upsert dans `integrations`.
4. La table `integrations` n'est **jamais** lue côté client. Seul le serveur (service_role, cron, actions) la touche.

**Refresh** : Vercel Cron `/api/cron/refresh-tokens` (toutes les 6 h) rafraîchit les tokens qui expirent bientôt. On ne logge **jamais** un token, même tronqué.

### Esquisse `lib/crypto.ts`

```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, 'base64'); // 32 octets

export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  const tag = c.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}
export function decrypt(payload: string) {
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), enc = buf.subarray(28);
  const d = createDecipheriv('aes-256-gcm', key, iv); d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}
```

---

## 3. Emails (Resend)

- **Transactionnels** (invitations, rappels) : Resend, from `no-reply@ton-domaine`.
- **Relances commerciales** : deux options —
  - *Resend* avec templates (simple, mais l'email ne s'affiche pas dans la boîte « Envoyés » du user).
  - *Gmail/Outlook connecté* (scope `*.send`) : l'email part de la vraie adresse du user, traçable côté fiche. Recommandé pour la relance.
- Chaque envoi crée une activité `email` sur la fiche.

---

## 4. Ouvert à tout — webhooks & API

**Webhooks sortants** (`webhooks`) : à chaque événement clé, POST signé HMAC vers l'URL configurée.

```
Événements : contact.created · company.created · deal.created · deal.stage_changed
             deal.won · deal.lost · task.created · task.completed
Header      : X-Kairos-Signature: sha256=<hmac(secret, body)>
```

**API REST** (clés dans `api_keys`, hashées) : `GET/POST /api/v1/contacts`, `/deals`, `/tasks`…
→ permet de brancher **Make / Zapier / n8n** et donc, indirectement, *n'importe quelle app* : Slack, WhatsApp Business, un logiciel notarial, un formulaire de site, etc.

**Entrant** (optionnel) : `/api/webhooks/[id]` pour recevoir un lead depuis un formulaire externe et créer une company/contact.

---

## 5. Checklist sécurité des intégrations

- [ ] Tokens chiffrés au repos, jamais loggés, jamais renvoyés au client.
- [ ] `state` OAuth signé et vérifié (anti-CSRF).
- [ ] Scopes minimaux, révocables depuis Réglages → Intégrations.
- [ ] Webhooks signés (HMAC) ; clés API hashées + préfixe affiché seulement.
- [ ] Refresh géré par cron protégé par `CRON_SECRET`.
- [ ] Suppression d'une intégration → nettoyage des `external_event_id` liés.


---

<a id="partie-8"></a>

# Partie 8/13 — Moteur d'automatisations

<sub>Fichier source : `docs/AUTOMATIONS.md`</sub>

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


---

<a id="partie-9"></a>

# Partie 9/13 — White-label : dupliquer pour un client

<sub>Fichier source : `docs/WHITE-LABEL.md`</sub>

# docs/WHITE-LABEL.md — Dupliquer & rebrander pour un client

Kairos est conçu pour être **ton produit**, que tu déploies pour Biancola puis proposes à tes clients (notaires, agences immo, TPE/PME). Deux modèles, à choisir selon le client.

---

## Modèle A — SaaS mutualisé (recommandé par défaut)

**Un seul déploiement** (un projet Vercel + un projet Supabase). Chaque client = **un workspace**. L'étanchéité est garantie par la RLS (`workspace_id` + `is_workspace_member`).

**Avantages :** un seul truc à maintenir, coûts mutualisés (marge quasi nette), mises à jour instantanées pour tous, onboarding en minutes (tu crées un espace, tu invites le client).

**Rebranding par espace** (sans redéployer) : dans `workspaces.branding` →
- `brand_name` : le nom affiché (ex. « CRM Étude Notariale Martin »).
- `logo_url` : leur logo (upload Supabase Storage).
- `accent`, `radius`, `mode` : leurs couleurs, arrondi, clair/sombre.
- `stages.color` : leurs couleurs d'étapes.

**Domaine par client (option) :** un sous-domaine `client.ton-crm.be` (wildcard DNS + résolution du workspace par slug/host dans le middleware), ou un domaine à eux pointé sur Vercel avec mapping host → workspace.

**Facturation :** abonnement mensuel par espace (ex. 19–49 €/mois selon features). Brancher Stripe plus tard (V2) — au début, facture manuelle.

**Pour ce modèle, rien de plus à coder que le MVP.** Le multi-tenant est déjà dans le schéma.

---

## Modèle B — Instance dédiée (client sensible / exigeant)

Pour un client qui veut **ses données isolées physiquement** (notaire, exigence RGPD forte, ou gros volume) : tu **forkes le repo** et déploies un **Supabase + Vercel dédiés**.

**Procédure :**
1. Dupliquer le repo → `kairos-client-x`.
2. Nouveau projet Supabase (`eu-central-1`) → exécuter `0001_init.sql`.
3. Nouveau projet Vercel → variables d'env du client (voir `.env.example`).
4. OAuth : créer les identifiants Google/Microsoft au nom du client (ou réutiliser les tiens si tu restes l'éditeur).
5. Régler le branding par défaut dans `config/theme.ts` + `workspaces.branding`.
6. Domaine à eux.

**Avantages :** isolation totale, personnalisation profonde possible. **Coût :** un déploiement à maintenir par client → réserver aux contrats qui le justifient (setup facturé + maintenance mensuelle).

---

## Grille de décision

| Critère | Modèle A (mutualisé) | Modèle B (dédié) |
|---|---|---|
| Rapidité de mise en place | Minutes | Une demi-journée |
| Coût récurrent | Mutualisé (faible) | Un stack par client |
| Isolation des données | Logique (RLS) | Physique |
| Personnalisation | Branding + champs + étapes | Illimitée (code) |
| Idéal pour | TPE, artisans, agences | Notaire, données très sensibles, gros client |

**Règle indie hacker :** commence **tout le monde en Modèle A**. Ne passe un client en Modèle B que s'il le demande explicitement et le paie. Ne construis pas l'usine avant d'avoir la commande.

---

## Ce qu'il faut préparer pour vendre proprement (RGPD)

- Mention d'hébergement UE (Supabase `eu-central-1`).
- Export & suppression des données d'un espace sur demande (prévu Phase 5).
- Sous-traitance : si tu héberges les données d'un client, tu es sous-traitant au sens RGPD → prévoir un mini contrat de sous-traitance (DPA). Pour un notaire, faire valider par eux avant mise en prod.
- Journalisation des accès (les `activities` + `automation_runs` aident déjà).


---

<a id="partie-10"></a>

# Partie 10/13 — Schéma Supabase — 0001_init.sql

<sub>Fichier source : `supabase/migrations/0001_init.sql`</sub>

```sql
-- ============================================================================
-- KAIROS — Schéma initial (Postgres / Supabase)
-- Multi-tenant par workspace, RLS stricte, région eu-central-1.
-- À exécuter dans SQL Editor (ou `supabase db push`).
-- ============================================================================

create extension if not exists pgcrypto;      -- gen_random_uuid()
create extension if not exists pg_trgm;        -- recherche floue (LIKE / similarité)

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
create type member_role         as enum ('owner', 'admin', 'member');
create type deal_status         as enum ('open', 'won', 'lost');
create type priority_level      as enum ('low', 'normal', 'high');
create type activity_type       as enum ('note', 'email', 'call', 'meeting', 'task', 'stage_change', 'system');
create type task_kind           as enum ('follow_up', 'call', 'email', 'meeting', 'todo');
create type integration_provider as enum ('google', 'microsoft');
create type custom_entity       as enum ('company', 'contact', 'deal');
create type custom_field_type   as enum ('text', 'number', 'date', 'select', 'checkbox', 'url', 'email', 'phone');

-- ----------------------------------------------------------------------------
-- PROFILES (miroir de auth.users)
-- ----------------------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table profiles is 'Profil applicatif lié à un utilisateur Supabase Auth.';

-- ----------------------------------------------------------------------------
-- WORKSPACES (le tenant) + branding/thème
-- ----------------------------------------------------------------------------
create table workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  -- branding white-label : { brand_name, logo_url, accent, radius, mode }
  branding    jsonb not null default '{"accent":"#4F46E5","radius":"0.75rem","mode":"light"}'::jsonb,
  timezone    text not null default 'Europe/Brussels',
  plan        text not null default 'free',
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table workspaces is 'Espace de travail = un client. Contient son branding et ses réglages.';

create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         member_role not null default 'member',
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index on workspace_members(user_id);

-- ----------------------------------------------------------------------------
-- Fonctions d'appartenance (SECURITY DEFINER pour éviter la récursion RLS)
-- ----------------------------------------------------------------------------
create or replace function is_workspace_member(ws uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

create or replace function is_workspace_admin(ws uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws and user_id = auth.uid() and role in ('owner','admin')
  );
$$;

grant execute on function is_workspace_member(uuid) to authenticated;
grant execute on function is_workspace_admin(uuid)  to authenticated;

-- ----------------------------------------------------------------------------
-- PIPELINES & STAGES (étapes personnalisables + couleurs)
-- ----------------------------------------------------------------------------
create table pipelines (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null default 'Prospection',
  is_default   boolean not null default true,
  created_at   timestamptz not null default now()
);
create index on pipelines(workspace_id);

create table stages (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  pipeline_id  uuid not null references pipelines(id) on delete cascade,
  name         text not null,
  color        text not null default '#6C8CFF',   -- personnalisable
  position     int  not null default 0,
  probability  int  not null default 0,           -- 0..100, pour prévisions
  is_won       boolean not null default false,
  is_lost      boolean not null default false,
  created_at   timestamptz not null default now()
);
create index on stages(workspace_id);
create index on stages(pipeline_id, position);

-- ----------------------------------------------------------------------------
-- TAGS (catalogue par espace, pour couleurs)
-- ----------------------------------------------------------------------------
create table tags (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  color        text not null default '#94A3B8',
  unique (workspace_id, name)
);
create index on tags(workspace_id);

-- ----------------------------------------------------------------------------
-- CHAMPS PERSONNALISÉS (modularité) — valeurs stockées dans .custom (jsonb)
-- ----------------------------------------------------------------------------
create table custom_fields (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  entity       custom_entity not null,
  key          text not null,                      -- ex: 'siret'
  label        text not null,                       -- ex: 'N° BCE'
  type         custom_field_type not null default 'text',
  options      jsonb,                               -- pour 'select'
  position     int not null default 0,
  unique (workspace_id, entity, key)
);
create index on custom_fields(workspace_id, entity);

-- ----------------------------------------------------------------------------
-- COMPANIES (comptes / entreprises)
-- ----------------------------------------------------------------------------
create table companies (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  email        text,
  phone        text,
  website      text,
  sector       text,
  address      text,
  city         text,
  country      text default 'BE',
  size         text,                                -- '1-10', '11-50', …
  tags         text[] not null default '{}',
  custom       jsonb  not null default '{}'::jsonb,
  owner_id     uuid references auth.users(id) on delete set null,
  source       text,                                -- 'import', 'manual', 'form', …
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on companies(workspace_id);
create index on companies using gin (name gin_trgm_ops);
create index on companies using gin (tags);

-- ----------------------------------------------------------------------------
-- CONTACTS (personnes, rattachées à une company)
-- ----------------------------------------------------------------------------
create table contacts (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id   uuid references companies(id) on delete set null,
  first_name   text,
  last_name    text,
  email        text,
  phone        text,
  role_title   text,                                -- fonction
  tags         text[] not null default '{}',
  custom       jsonb  not null default '{}'::jsonb,
  owner_id     uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on contacts(workspace_id);
create index on contacts(company_id);
create index on contacts using gin ((coalesce(first_name,'') || ' ' || coalesce(last_name,'')) gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- DEALS (opportunités dans le pipeline)
-- ----------------------------------------------------------------------------
create table deals (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  pipeline_id   uuid not null references pipelines(id) on delete cascade,
  stage_id      uuid not null references stages(id) on delete restrict,
  company_id    uuid references companies(id) on delete set null,
  contact_id    uuid references contacts(id) on delete set null,
  title         text not null,
  value         numeric(12,2) default 0,
  currency      text not null default 'EUR',
  priority      priority_level not null default 'normal',
  status        deal_status not null default 'open',
  expected_close date,
  last_activity_at timestamptz,                     -- pour détecter les deals « qui dorment »
  owner_id      uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on deals(workspace_id);
create index on deals(workspace_id, stage_id);
create index on deals(workspace_id, status);
create index on deals(last_activity_at);

-- ----------------------------------------------------------------------------
-- ACTIVITIES (timeline polymorphe : company / contact / deal)
-- ----------------------------------------------------------------------------
create table activities (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  subject_type custom_entity not null,              -- company | contact | deal
  subject_id   uuid not null,
  type         activity_type not null default 'note',
  content      text,
  meta         jsonb not null default '{}'::jsonb,  -- {from_stage, to_stage, email_id…}
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index on activities(workspace_id);
create index on activities(subject_type, subject_id, created_at desc);

-- ----------------------------------------------------------------------------
-- TASKS (relances = objet central du produit)
-- ----------------------------------------------------------------------------
create table tasks (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  title         text not null,
  kind          task_kind not null default 'follow_up',
  notes         text,
  due_at        timestamptz not null,
  remind_at     timestamptz,                        -- rappel avant l'échéance
  done          boolean not null default false,
  done_at       timestamptz,
  priority      priority_level not null default 'normal',
  -- rattachements (au moins un, en pratique)
  company_id    uuid references companies(id) on delete cascade,
  contact_id    uuid references contacts(id) on delete cascade,
  deal_id       uuid references deals(id) on delete cascade,
  assignee_id   uuid references auth.users(id) on delete set null,
  -- synchronisation calendrier (idempotence)
  calendar_provider integration_provider,
  external_event_id text,                           -- id de l'événement Google/MS
  calendar_synced_at timestamptz,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on tasks(workspace_id);
create index on tasks(workspace_id, due_at) where done = false;   -- vue « à faire »
create index on tasks(assignee_id) where done = false;
create index on tasks(deal_id);

-- ----------------------------------------------------------------------------
-- INTEGRATIONS (tokens OAuth chiffrés — 1 par user et par provider)
-- ----------------------------------------------------------------------------
create table integrations (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references workspaces(id) on delete cascade,
  user_id            uuid not null references auth.users(id) on delete cascade,
  provider           integration_provider not null,
  account_email      text,
  access_token_enc   text not null,                 -- AES-GCM (lib/crypto.ts)
  refresh_token_enc  text,
  scopes             text[] not null default '{}',
  expires_at         timestamptz,
  calendar_id        text default 'primary',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (workspace_id, user_id, provider)
);
create index on integrations(workspace_id);
-- Sécurité : cette table n'est JAMAIS lue côté client (tokens). Accès service_role uniquement.

-- ----------------------------------------------------------------------------
-- AUTOMATIONS (moteur « quand X → faire Y ») — voir docs/AUTOMATIONS.md
-- ----------------------------------------------------------------------------
create table automations (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  enabled      boolean not null default true,
  trigger      jsonb not null,     -- { event: 'task.created', ... }
  conditions   jsonb not null default '[]'::jsonb,
  actions      jsonb not null,     -- [ { type:'calendar.create_event', ... }, ... ]
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on automations(workspace_id) where enabled = true;

create table automation_runs (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  automation_id uuid references automations(id) on delete set null,
  status        text not null default 'success',   -- success | error
  detail        jsonb,
  created_at    timestamptz not null default now()
);
create index on automation_runs(workspace_id, created_at desc);

-- ----------------------------------------------------------------------------
-- WEBHOOKS sortants + CLÉS API (connecter n'importe quelle app)
-- ----------------------------------------------------------------------------
create table webhooks (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  url          text not null,
  events       text[] not null default '{}',        -- ['deal.stage_changed', …]
  secret       text not null,                        -- signature HMAC
  enabled      boolean not null default true,
  created_at   timestamptz not null default now()
);
create index on webhooks(workspace_id) where enabled = true;

create table api_keys (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  key_hash     text not null,                        -- hash de la clé (jamais en clair)
  prefix       text not null,                        -- 4 premiers car. pour l'affichage
  last_used_at timestamptz,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index on api_keys(workspace_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- updated_at automatique
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','workspaces','companies','contacts','deals','tasks','integrations','automations'
  ] loop
    execute format(
      'create trigger trg_%1$s_updated before update on %1$s
       for each row execute function set_updated_at();', t);
  end loop;
end $$;

-- Nouvel utilisateur → profil + workspace perso + membership owner + pipeline + étapes
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ws_id uuid;
  pl_id uuid;
  disp  text := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1));
begin
  insert into profiles(id, full_name) values (new.id, disp);

  insert into workspaces(name, slug, created_by)
  values (disp || ' — Espace', 'ws-' || substr(new.id::text,1,8), new.id)
  returning id into ws_id;

  insert into workspace_members(workspace_id, user_id, role)
  values (ws_id, new.id, 'owner');

  insert into pipelines(workspace_id, name, is_default)
  values (ws_id, 'Prospection', true)
  returning id into pl_id;

  insert into stages(workspace_id, pipeline_id, name, color, position, probability, is_won, is_lost) values
    (ws_id, pl_id, 'À contacter',   '#6C8CFF', 0, 10,  false, false),
    (ws_id, pl_id, 'Contacté',      '#F59E0B', 1, 20,  false, false),
    (ws_id, pl_id, 'En discussion', '#EF4444', 2, 45,  false, false),
    (ws_id, pl_id, 'RDV / Devis',   '#8B5CF6', 3, 70,  false, false),
    (ws_id, pl_id, 'Client',        '#22C55E', 4, 100, true,  false),
    (ws_id, pl_id, 'Perdu',         '#94A3B8', 5, 0,   false, true);

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Changement d'étape d'un deal → entrée timeline + maj last_activity_at
create or replace function log_deal_stage_change()
returns trigger language plpgsql as $$
begin
  if new.stage_id is distinct from old.stage_id then
    insert into activities(workspace_id, subject_type, subject_id, type, content, meta, created_by)
    values (new.workspace_id, 'deal', new.id, 'stage_change', null,
            jsonb_build_object('from', old.stage_id, 'to', new.stage_id), auth.uid());
    new.last_activity_at = now();
    -- statut auto si l'étape est gagnée/perdue
    if exists (select 1 from stages where id = new.stage_id and is_won)  then new.status = 'won';
    elsif exists (select 1 from stages where id = new.stage_id and is_lost) then new.status = 'lost';
    else new.status = 'open';
    end if;
  end if;
  return new;
end $$;

create trigger trg_deal_stage_change before update on deals
  for each row execute function log_deal_stage_change();

-- Tâche terminée → timeline sur le rattachement principal
create or replace function log_task_done()
returns trigger language plpgsql as $$
declare sid uuid; stype custom_entity;
begin
  if new.done and not old.done then
    new.done_at = now();
    if    new.deal_id    is not null then stype := 'deal';    sid := new.deal_id;
    elsif new.contact_id is not null then stype := 'contact'; sid := new.contact_id;
    elsif new.company_id is not null then stype := 'company'; sid := new.company_id;
    end if;
    if sid is not null then
      insert into activities(workspace_id, subject_type, subject_id, type, content, created_by)
      values (new.workspace_id, stype, sid, 'task', 'Tâche terminée : ' || new.title, auth.uid());
    end if;
  end if;
  return new;
end $$;

create trigger trg_task_done before update on tasks
  for each row execute function log_task_done();

-- ============================================================================
-- RLS — tout est fermé par défaut, on ouvre par appartenance au workspace
-- ============================================================================
alter table profiles          enable row level security;
alter table workspaces         enable row level security;
alter table workspace_members  enable row level security;
alter table pipelines          enable row level security;
alter table stages             enable row level security;
alter table tags               enable row level security;
alter table custom_fields      enable row level security;
alter table companies          enable row level security;
alter table contacts           enable row level security;
alter table deals              enable row level security;
alter table activities         enable row level security;
alter table tasks              enable row level security;
alter table integrations       enable row level security;
alter table automations        enable row level security;
alter table automation_runs    enable row level security;
alter table webhooks           enable row level security;
alter table api_keys           enable row level security;

-- profiles : je vois/édite le mien ; je vois ceux qui partagent un de mes espaces
create policy "profil : soi-même (read)"  on profiles for select using (id = auth.uid());
create policy "profil : soi-même (write)" on profiles for update using (id = auth.uid());
create policy "profil : collègues" on profiles for select using (
  exists (
    select 1 from workspace_members m1
    join workspace_members m2 on m1.workspace_id = m2.workspace_id
    where m1.user_id = auth.uid() and m2.user_id = profiles.id
  )
);

-- workspaces : membres en lecture ; admins en écriture ; tout authentifié peut créer
create policy "ws : membres (read)"   on workspaces for select using (is_workspace_member(id));
create policy "ws : créer"            on workspaces for insert with check (created_by = auth.uid());
create policy "ws : admin (update)"   on workspaces for update using (is_workspace_admin(id));
create policy "ws : owner (delete)"   on workspaces for delete using (
  exists (select 1 from workspace_members where workspace_id = id and user_id = auth.uid() and role = 'owner')
);

-- workspace_members : membres voient la liste ; admins gèrent
create policy "membres : lire"   on workspace_members for select using (is_workspace_member(workspace_id));
create policy "membres : gérer"  on workspace_members for all
  using (is_workspace_admin(workspace_id)) with check (is_workspace_admin(workspace_id));

-- Macro : mêmes 4 policies « membre » pour toutes les tables métier
do $$
declare t text;
begin
  foreach t in array array[
    'pipelines','stages','tags','custom_fields','companies','contacts',
    'deals','activities','tasks','automations','automation_runs','webhooks'
  ] loop
    execute format($f$
      create policy "%1$s : lire"     on %1$s for select using (is_workspace_member(workspace_id));
      create policy "%1$s : créer"    on %1$s for insert with check (is_workspace_member(workspace_id));
      create policy "%1$s : modifier" on %1$s for update using (is_workspace_member(workspace_id));
      create policy "%1$s : suppr"    on %1$s for delete using (is_workspace_member(workspace_id));
    $f$, t);
  end loop;
end $$;

-- api_keys : admins seulement (contiennent des secrets)
create policy "api_keys : admin" on api_keys for all
  using (is_workspace_admin(workspace_id)) with check (is_workspace_admin(workspace_id));

-- integrations : chaque user gère SES connexions ; jamais lisible côté client autrement.
-- (les tokens sont manipulés par le serveur via service_role, qui bypass la RLS)
create policy "integrations : soi-même" on integrations for all
  using (user_id = auth.uid() and is_workspace_member(workspace_id))
  with check (user_id = auth.uid() and is_workspace_member(workspace_id));

-- Fin 0001_init.sql
```


---

<a id="partie-11"></a>

# Partie 11/13 — Seed de démo — 0002_seed.sql

<sub>Fichier source : `supabase/migrations/0002_seed.sql`</sub>

```sql
-- ============================================================================
-- KAIROS — Seed de démonstration (optionnel)
-- Les 202 entreprises de Biancola s'importent via l'UI (Import CSV) une fois
-- l'app en place. Ce seed sert juste à avoir de quoi cliquer en dev.
--
-- Mode d'emploi : après avoir créé un compte (ce qui crée automatiquement ton
-- workspace + pipeline + étapes), récupère l'id de ton workspace :
--   select id, name from workspaces;
-- puis remplace la valeur ci-dessous et exécute ce fichier.
-- ============================================================================

do $$
declare
  ws        uuid := '00000000-0000-0000-0000-000000000000';  -- ← REMPLACE
  pl        uuid;
  st_new    uuid; st_contacted uuid; st_discuss uuid;
  c1 uuid; c2 uuid; c3 uuid;
begin
  select id into pl from pipelines where workspace_id = ws and is_default limit 1;
  select id into st_new       from stages where pipeline_id = pl and position = 0;
  select id into st_contacted from stages where pipeline_id = pl and position = 1;
  select id into st_discuss   from stages where pipeline_id = pl and position = 2;

  insert into companies(workspace_id, name, email, sector, city, source) values
    (ws, 'Menuiserie Dupont', 'info@menuiserie-dupont.be', 'Menuiserie', 'Liège', 'manual') returning id into c1;
  insert into companies(workspace_id, name, email, sector, city, source) values
    (ws, 'Boucha Group', 'info@boucha.be', 'Industrie', 'Herstal', 'import') returning id into c2;
  insert into companies(workspace_id, name, email, sector, city, source) values
    (ws, 'Electro-Test', null, 'Électronique', 'Seraing', 'import') returning id into c3;

  -- Deals dans le pipeline
  insert into deals(workspace_id, pipeline_id, stage_id, company_id, title, priority, last_activity_at) values
    (ws, pl, st_new,       c1, 'Site vitrine Menuiserie Dupont', 'high',   now()),
    (ws, pl, st_contacted, c2, 'Refonte site Boucha Group',      'normal', now() - interval '6 days'),
    (ws, pl, st_discuss,   c3, 'Outil interne Electro-Test',     'normal', now() - interval '2 days');

  -- Une relance en retard (pour tester la vue « Aujourd'hui »)
  insert into tasks(workspace_id, title, kind, due_at, company_id, priority) values
    (ws, 'Relancer Boucha Group', 'follow_up', now() - interval '1 day', c2, 'high');

  raise notice 'Seed inséré pour le workspace %', ws;
end $$;
```


---

<a id="partie-12"></a>

# Partie 12/13 — Variables d'environnement — .env.example

<sub>Fichier source : `.env.example`</sub>

```bash
# ============================================================================
# KAIROS — Variables d'environnement (copier en .env.local et remplir)
# Ne JAMAIS committer .env.local. Les valeurs SUPABASE_SERVICE_ROLE_KEY,
# *_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY et CRON_SECRET sont ultra-sensibles.
# ============================================================================

# --- App -------------------------------------------------------------------
NEXT_PUBLIC_APP_URL=http://localhost:3000

# --- Supabase --------------------------------------------------------------
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...            # clé publique (safe côté client)
SUPABASE_SERVICE_ROLE_KEY=eyJ...                # SECRET — serveur uniquement (cron, webhooks)

# --- Emails (Resend) -------------------------------------------------------
RESEND_API_KEY=re_...
RESEND_FROM="Kairos <no-reply@ton-domaine.be>"

# --- Chiffrement des tokens OAuth ------------------------------------------
# Générer une clé 32 octets en base64 :  openssl rand -base64 32
TOKEN_ENCRYPTION_KEY=

# --- Google OAuth (Calendar, éventuellement Gmail) -------------------------
# Google Cloud Console → API & Services → Identifiants → ID client OAuth (Web)
# Redirect URI : {NEXT_PUBLIC_APP_URL}/api/integrations/google/callback
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# --- Microsoft OAuth (Outlook / Graph) — Phase 4 ---------------------------
# Entra ID (Azure AD) → App registrations
# Redirect URI : {NEXT_PUBLIC_APP_URL}/api/integrations/microsoft/callback
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=

# --- Cron (Vercel) ---------------------------------------------------------
# Protège /api/cron/* (rappels + refresh tokens). Générer : openssl rand -hex 32
CRON_SECRET=
```


---

<a id="partie-13"></a>

# Partie 13/13 — Dépendances — package.json

<sub>Fichier source : `package.json`</sub>

```json
{
  "name": "kairos",
  "version": "0.1.0",
  "private": true,
  "description": "Kairos — CRM connecté, relance-first, white-label (Biancola Studio)",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "db:types": "supabase gen types typescript --linked > src/types/db.ts",
    "db:push": "supabase db push"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@supabase/supabase-js": "^2.45.0",
    "@supabase/ssr": "^0.5.0",
    "@tanstack/react-query": "^5.51.0",
    "zod": "^3.23.0",
    "react-hook-form": "^7.52.0",
    "@hookform/resolvers": "^3.9.0",
    "lucide-react": "^0.400.0",
    "date-fns": "^3.6.0",
    "date-fns-tz": "^3.1.0",
    "sonner": "^1.5.0",
    "cmdk": "^1.0.0",
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.4.0",
    "googleapis": "^140.0.0",
    "resend": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "^15.0.0",
    "supabase": "^1.190.0"
  },
  "_note": "shadcn/ui s'installe via 'npx shadcn@latest add ...' et écrit ses composants dans src/components/ui. Versions indicatives — laisser create-next-app + npm fixer les dernières compatibles au scaffold (Phase 0)."
}
```


---

<sub>Fin du dossier Kairos. Les 13 fichiers existent aussi séparément dans l'arborescence du projet (`README.md`, `BRIEF.md`, `CLAUDE.md`, `ROADMAP.md`, `docs/`, `supabase/migrations/`). Ce document maître en est la version compilée.</sub>
