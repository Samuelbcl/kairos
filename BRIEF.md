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
