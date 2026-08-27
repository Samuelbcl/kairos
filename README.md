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
