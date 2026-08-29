-- ============================================================================
-- KAIROS — Visite guidée
--
-- Stocké sur le profil et non dans le navigateur : quelqu'un qui se connecte
-- depuis son téléphone après l'avoir suivie sur son ordinateur ne doit pas la
-- revoir. Et on veut pouvoir la relancer depuis les réglages.
-- ============================================================================

alter table profiles
  add column if not exists tour_completed_at timestamptz,
  add column if not exists tour_step int not null default 0;

comment on column profiles.tour_completed_at is
  'Non nul = visite guidée terminée ou passée. Remis à null pour la rejouer.';
comment on column profiles.tour_step is
  'Dernière étape atteinte, pour reprendre où on s''est arrêté.';
