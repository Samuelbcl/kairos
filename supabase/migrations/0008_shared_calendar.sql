-- ============================================================================
-- KAIROS — Agenda partagé à l'échelle de l'espace (vague 1)
--
-- La synchronisation agenda cherchait les jetons de l'utilisateur connecté.
-- Une relance créée par l'API ou par une automatisation du cron n'a pas de
-- session : elle restait dans Kairos et n'atteignait jamais aucun agenda.
-- C'est la promesse centrale du produit qui tombait dans ces deux cas.
--
-- On autorise une intégration à servir tout l'espace. Chacun garde la main :
-- un membre peut refuser que son agenda reçoive les relances des autres.
-- ============================================================================

alter table integrations
  add column if not exists share_with_workspace boolean not null default true;

comment on column integrations.share_with_workspace is
  'Cet agenda peut recevoir les relances créées sans session (API, cron, automatisations).';

-- Retrouver rapidement les relances jamais poussées vers un agenda.
create index if not exists tasks_unsynced_idx
  on tasks (workspace_id, due_at)
  where done = false and external_event_id is null;
