# docs/RGPD.md — Conformité et sous-traitance

> Ce document décrit ce que Kairos fait déjà et ce qu'il reste à formaliser.
> **Il ne remplace pas un avis juridique.** Pour un client sensible — notaire,
> cabinet médical, étude d'avocats — fais valider ces pages par son conseil
> avant la mise en production.

## Qui est quoi

Quand tu héberges les données d'un client sur ton déploiement Kairos :

- **le client est responsable de traitement** — c'est lui qui décide pourquoi
  et comment ses prospects sont traités ;
- **tu es sous-traitant** — tu traites ces données pour son compte et selon ses
  instructions.

Cette qualification impose un **contrat de sous-traitance** écrit (article 28
du RGPD). Le modèle est en fin de document.

## Ce que Kairos fait déjà

| Exigence | Où c'est traité |
|---|---|
| Hébergement dans l'Union européenne | Supabase, région `eu-central-1` (Francfort) |
| Cloisonnement entre clients | RLS Postgres sur les 17 tables, vérifiée par `npm run test:rls` |
| Droit d'accès et portabilité (art. 15, 20) | Réglages → Espace → Exporter mes données, JSON complet |
| Droit à l'effacement (art. 17) | Suppression d'un espace, confirmée par saisie du nom |
| Effacement effectif | Corbeille trente jours puis purge automatique (`/api/cron/purge`) |
| Chiffrement des secrets | Jetons OAuth en AES-256-GCM, clés API hachées en SHA-256 |
| Journalisation des accès | `activities`, `automation_runs`, `admin_access_log` |
| Minimisation des accès de support | La console éditeur montre des compteurs, jamais le contenu des fiches |

## Ce qu'il reste à produire

Ces éléments sont **administratifs**, pas techniques. Aucun code ne les
remplacera.

1. **Contrat de sous-traitance** signé avec chaque client hébergé (modèle plus bas).
2. **Registre des traitements** — le tien, en tant que sous-traitant
   (article 30.2). Une page suffit : catégories de données, catégories de
   personnes concernées, destinataires, durées de conservation, mesures de
   sécurité.
3. **Politique de conservation** communiquée aux clients : combien de temps une
   fiche inactive reste, ce qui part avec un espace supprimé.
4. **Procédure de violation de données** — qui prévenir, sous quel délai
   (72 h vers le responsable de traitement), avec quel modèle de message.
5. **Liste des sous-traitants ultérieurs** : Supabase (base et stockage),
   Vercel (hébergement applicatif), Resend (e-mails), Google et Microsoft
   (agendas, à la demande du client). Le client doit pouvoir la consulter et
   s'opposer à un changement.

## Durées de conservation appliquées

| Donnée | Conservation | Mécanisme |
|---|---|---|
| Fiches supprimées | 30 jours | `purge_deleted()`, cron quotidien |
| Espace supprimé | Immédiat, en cascade | `on delete cascade` |
| Compte supprimé | Immédiat ; l'espace suit s'il perd son dernier membre | Trigger `delete_orphan_workspace` |
| Journal des livraisons webhook | À définir avec le client | Purge à écrire |
| Journal d'accès éditeur | À définir — 12 mois est un usage courant | Purge à écrire |

Les deux dernières lignes sont des trous connus : ces tables grossissent sans
limite aujourd'hui.

## Ce qu'un client doit pouvoir obtenir en une demande

- **Ses données**, dans un format lisible par machine → export JSON, immédiat.
- **La suppression** de tout son espace → effective, sans passer par toi.
- **La liste de qui accède à quoi** → membres de l'espace et leurs rôles.
- **Les traces d'accès de ton support** → `admin_access_log`, à lui exposer sur
  demande.

## Modèle de contrat de sous-traitance

À adapter, puis à faire relire. Les crochets sont à compléter.

> **Entre** [ta raison sociale], [adresse], [numéro d'entreprise] — le
> **sous-traitant** — et [client], [adresse], [numéro] — le **responsable de
> traitement**.
>
> **1. Objet.** Le sous-traitant héberge et exploite pour le compte du
> responsable un outil de gestion de la relation client, et traite à ce titre
> des données à caractère personnel.
>
> **2. Nature des traitements.** Hébergement, conservation, consultation,
> sauvegarde, effacement. Aucun autre usage : les données ne sont ni revendues,
> ni utilisées à des fins propres, ni exploitées pour entraîner un modèle.
>
> **3. Données concernées.** Identité et coordonnées professionnelles de
> prospects et clients du responsable : nom, entreprise, e-mail, téléphone,
> adresse, historique des échanges, rendez-vous.
>
> **4. Personnes concernées.** Prospects, clients et interlocuteurs
> professionnels du responsable.
>
> **5. Durée.** La durée du contrat de service. À son terme, les données sont
> restituées au format JSON puis effacées dans un délai de trente jours.
>
> **6. Instructions.** Le sous-traitant ne traite les données que sur
> instruction documentée du responsable, y compris pour tout transfert hors
> Union européenne — aucun n'est prévu à ce jour.
>
> **7. Confidentialité.** Toute personne ayant accès aux données y est astreinte.
>
> **8. Sécurité.** Chiffrement en transit et au repos, cloisonnement des espaces
> au niveau de la base, authentification par lien à usage unique ou fournisseur
> tiers, journalisation des accès, sauvegardes gérées par l'hébergeur.
>
> **9. Sous-traitants ultérieurs.** Supabase (Irlande/Allemagne), Vercel,
> Resend. Le responsable est informé de tout ajout et peut s'y opposer.
>
> **10. Assistance.** Le sous-traitant assiste le responsable pour répondre aux
> demandes d'exercice de droits et pour toute analyse d'impact.
>
> **11. Violation de données.** Notification au responsable dans les 72 heures
> suivant la prise de connaissance, avec la nature de la violation, les
> catégories et le volume concernés, et les mesures prises.
>
> **12. Audit.** Le responsable peut demander une fois par an les éléments
> justifiant du respect des présentes.

## Avant de signer avec un client sensible

Un notaire ou un cabinet d'avocats demandera généralement, en plus :

- l'hébergement des données **dans un pays précis** — Supabase permet de choisir
  la région à la création du projet, mais pas de la changer ensuite ;
- une **instance dédiée** plutôt que mutualisée → voir `docs/WHITE-LABEL.md`,
  modèle B ;
- une **attestation d'assurance** responsabilité civile professionnelle ;
- parfois un **droit d'audit sur site**.

Prévois ces demandes avant le premier rendez-vous : elles arrivent tard dans la
négociation et bloquent la signature.
