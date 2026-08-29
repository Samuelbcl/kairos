# Kairos — le CRM connecté de Biancola Studio

> **Kairos** (καιρός) : « le bon moment ». Un CRM pensé autour d'une seule obsession — ne jamais rater une relance — dans une interface moderne, rapide et agréable, connectée à tout ton écosystème (Google, Microsoft, et n'importe quelle app via webhooks).

Ce dépôt est un **produit white-label**. Tu l'utilises d'abord pour Biancola Studio, puis tu le dupliques / rebrandes pour tes clients (notaires, agences immo, TPE/PME) — chaque client a son espace, son logo, ses couleurs, son pipeline.

---

## État

Les cinq phases de `ROADMAP.md` sont livrées : fondations, auth multi-tenant,
cœur CRM, relances et agenda, connectivité, personnalisation.

## Démarrage

> Prérequis : Node.js ≥ 20, un projet Supabase en `eu-central-1`.

```bash
npm install
cp .env.example .env.local     # puis remplis les valeurs
npm run db:sql supabase/migrations/0001_init.sql
npm run db:types
npm run dev                    # http://localhost:3000
```

Sans Supabase configuré, l'app affiche `/setup` avec la marche à suivre.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` | build de production |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | eslint |
| `npm run db:sql <fichier>` | exécute un fichier SQL sur la base distante |
| `npm run db:types` | régénère `src/types/db.ts` |
| `npm run db:state` | inventaire du schéma |
| `npm run test:rls` | étanchéité entre deux espaces (21 vérifications) |
| `npm run test:smoke` | parcourt toutes les pages avec une vraie session (16) |
| `npm run test:api` | API REST, cloisonnement et routes cron (20) |

Les trois scripts de test créent des comptes jetables et les suppriment ensuite,
y compris en cas d'échec.

## Variables d'environnement

Voir `.env.example`. En production, tout sauf `SUPABASE_DB_PASSWORD` et
`SUPABASE_ACCESS_TOKEN` (qui ne servent qu'aux scripts locaux). `NEXT_PUBLIC_APP_URL`
doit pointer vers l'URL de production : elle construit les URL de callback OAuth.

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

## Tâches planifiées

Un seul cron est déclaré dans `vercel.json` : `/api/cron/run`, qui appelle les
six travaux à la suite. Le plan Hobby de Vercel n'autorise que deux crons, une
fois par jour — en déclarer davantage fait **rejeter le déploiement entier**.

| Travail | Rôle |
|---|---|
| `reminders` | Envoie les rappels dus, déclenche `task.overdue` et `deal.stale` |
| `sync-calendar` | Pousse vers l'agenda les relances créées sans session (API, automatisations) |
| `pull-calendar` | Reporte dans Kairos les événements déplacés depuis l'agenda |
| `retry-webhooks` | Retente les livraisons en échec, à délai croissant |
| `refresh-tokens` | Rafraîchit les jetons OAuth proches de l'expiration |
| `purge` | Efface définitivement la corbeille au-delà de trente jours |

Chaque route reste appelable seule, pour un déclenchement manuel :

```bash
curl "https://ton-url.vercel.app/api/cron/reminders?secret=$CRON_SECRET"
```

**Sur un plan Pro**, remplace l'entrée unique par des planifications fines —
les rappels toutes les heures ont plus de valeur qu'une fois par jour :

```json
"crons": [
  { "path": "/api/cron/reminders",      "schedule": "0 * * * *" },
  { "path": "/api/cron/sync-calendar",  "schedule": "20 * * * *" },
  { "path": "/api/cron/pull-calendar",  "schedule": "40 * * * *" },
  { "path": "/api/cron/retry-webhooks", "schedule": "*/15 * * * *" },
  { "path": "/api/cron/refresh-tokens", "schedule": "0 */6 * * *" },
  { "path": "/api/cron/purge",          "schedule": "0 4 * * *" }
]
```
