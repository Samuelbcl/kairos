-- ============================================================================
-- KAIROS — Suppression réversible
--
-- Supprimer une entreprise emportait ses contacts, ses opportunités et ses
-- relances, définitivement. Un client qui perd trois mois de prospection sur un
-- clic ne reste pas client — et une action groupée sur deux cents fiches rend
-- l'erreur bien plus probable.
--
-- Les fiches partent à la corbeille et restent récupérables trente jours.
-- Le filtrage se fait dans les requêtes de l'application : le garder hors des
-- policies permet d'exposer la corbeille sans contorsion.
-- ============================================================================

alter table companies add column if not exists deleted_at timestamptz;
alter table contacts  add column if not exists deleted_at timestamptz;
alter table deals     add column if not exists deleted_at timestamptz;

comment on column companies.deleted_at is
  'Non nul = à la corbeille. Purgé automatiquement après 30 jours.';

-- Les listes filtrent sur deleted_at is null : l'index partiel garde ça rapide.
create index if not exists companies_live_idx on companies (workspace_id, updated_at desc)
  where deleted_at is null;
create index if not exists contacts_live_idx on contacts (workspace_id, updated_at desc)
  where deleted_at is null;
create index if not exists deals_live_idx on deals (workspace_id, stage_id)
  where deleted_at is null;

-- Purge définitive de ce qui traîne depuis plus de 30 jours.
create or replace function purge_deleted(older_than_days integer default 30)
returns integer language plpgsql security definer set search_path = public as $$
declare
  cutoff timestamptz := now() - make_interval(days => older_than_days);
  removed integer := 0;
  n integer;
begin
  delete from deals     where deleted_at is not null and deleted_at < cutoff;
  get diagnostics n = row_count; removed := removed + n;

  delete from contacts  where deleted_at is not null and deleted_at < cutoff;
  get diagnostics n = row_count; removed := removed + n;

  delete from companies where deleted_at is not null and deleted_at < cutoff;
  get diagnostics n = row_count; removed := removed + n;

  return removed;
end $$;

-- Mettre une entreprise à la corbeille y met aussi ce qui en dépend, pour que
-- la restauration ramène un ensemble cohérent.
create or replace function cascade_soft_delete()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.deleted_at is distinct from old.deleted_at then
    update contacts set deleted_at = new.deleted_at
     where company_id = new.id and workspace_id = new.workspace_id;
    update deals set deleted_at = new.deleted_at
     where company_id = new.id and workspace_id = new.workspace_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_company_soft_delete on companies;
create trigger trg_company_soft_delete
  after update of deleted_at on companies
  for each row execute function cascade_soft_delete();
