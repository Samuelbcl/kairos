-- Renommer les champs intégrés, par espace.
--
-- Les champs personnalisés couvraient l'ajout ; il manquait le renommage. Un
-- cabinet dit « Raison sociale » là où nous disons « Nom ». Sans ça, la
-- personnalisation s'arrête au logo et aux couleurs, ce qui ne suffit pas pour
-- un produit vendu en marque blanche.
--
-- Forme stockée : { "company.name": "Raison sociale", "contact.role_title": "Poste" }
-- Clé absente ou vide = nom d'origine. Aucun renommage n'altère les colonnes
-- de la base : seul l'affichage change, les imports et l'API gardent les mêmes
-- noms techniques.

alter table workspaces
  add column if not exists field_labels jsonb not null default '{}'::jsonb;

comment on column workspaces.field_labels is
  'Renommage des champs integres, indexe par "<entite>.<champ>". Affichage uniquement.';
