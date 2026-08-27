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
