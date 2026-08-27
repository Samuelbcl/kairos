# CLAUDE.md — Fichier maître (à lire en premier par Claude Code)

## Le projet en 4 lignes

**Kairos** est un CRM B2B web, multi-tenant et white-label, orienté « relance ». Chaque espace (workspace) gère comptes, contacts, deals dans un pipeline visuel, avec des tâches de relance qui se synchronisent nativement au calendrier (Google d'abord, Microsoft ensuite) et un moteur d'automatisations/webhooks pour connecter n'importe quelle app. UI en français, moderne, rapide et soignée. Premier utilisateur : Biancola Studio ; le produit est conçu pour être dupliqué/rebrandé pour des clients.

## Stack (imposée — ne pas dévier sans justification d'une ligne)

- **Next.js 16** (App Router, Server Components par défaut, Turbopack) + **TypeScript strict**
  - Écart assumé vs le brief initial (Next 15) : `create-next-app` installe désormais la 16, même
    architecture App Router / Server Actions. Trois conséquences à connaître par cœur :
    **le middleware s'appelle `src/proxy.ts`** (fonction exportée `proxy`, runtime Node),
    `cookies()` / `headers()` / `params` / `searchParams` sont **async uniquement**,
    et `next lint` n'existe plus (`npm run lint` appelle `eslint` directement).
  - Les docs de la version installée sont dans `node_modules/next/dist/docs/` : les lire avant
    d'écrire du code App Router plutôt que de se fier à la mémoire.
- **Tailwind CSS v4** (tokens en `@theme` dans `globals.css`, pas de `tailwind.config.ts`)
  + **shadcn/ui** (style `base-nova`, bâti sur **Base UI** — prop `render`, pas `asChild`)
  + **lucide-react** (icônes)
- **Supabase** : Postgres + Auth + Storage + **RLS**, région **eu-central-1**
- **@supabase/ssr** pour l'auth côté serveur (cookies), pas l'ancien auth-helpers
- **React Query** (@tanstack/react-query) pour le cache client ; Server Actions pour les mutations
- **zod v4** + **react-hook-form** pour les formulaires et la validation (`z.email()`, pas `z.string().email()`)
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
│   │   ├── setup/page.tsx             # écran d'aide si Supabase pas configuré
│   │   └── globals.css
│   ├── proxy.ts                       # ex-middleware.ts (Next 16) : session + garde auth
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
npm run lint           # eslint (next lint n'existe plus en Next 16)
npm run typecheck      # tsc --noEmit
npx next typegen       # régénère PageProps/LayoutProps/RouteContext
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
