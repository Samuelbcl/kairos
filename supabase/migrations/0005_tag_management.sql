-- ============================================================================
-- KAIROS — Gestion des tags
--
-- Les tags vivent dans des colonnes text[] sur companies et contacts, et le
-- catalogue `tags` (nom + couleur) n'était alimenté par rien. Conséquences :
-- impossible de renommer un tag partout, pas de couleur, et le filtre par tag
-- restait toujours vide.
--
-- Trois fonctions en SECURITY INVOKER : la RLS de l'appelant s'applique donc
-- normalement, on ne contourne rien.
-- ============================================================================

-- Renomme un tag partout : catalogue, entreprises, contacts.
create or replace function rename_workspace_tag(ws uuid, old_name text, new_name text)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if new_name is null or btrim(new_name) = '' then
    raise exception 'Le nouveau nom ne peut pas être vide';
  end if;

  update companies
     set tags = array_replace(tags, old_name, btrim(new_name))
   where workspace_id = ws and old_name = any(tags);

  update contacts
     set tags = array_replace(tags, old_name, btrim(new_name))
   where workspace_id = ws and old_name = any(tags);

  -- Si la cible existe déjà, les deux tags fusionnent : on retire l'ancien.
  if exists (select 1 from tags where workspace_id = ws and name = btrim(new_name)) then
    delete from tags where workspace_id = ws and name = old_name;
  else
    update tags set name = btrim(new_name) where workspace_id = ws and name = old_name;
  end if;
end $$;

-- Retire un tag du catalogue et de toutes les fiches qui le portent.
create or replace function delete_workspace_tag(ws uuid, tag_name text)
returns void language plpgsql security invoker set search_path = public as $$
begin
  update companies
     set tags = array_remove(tags, tag_name)
   where workspace_id = ws and tag_name = any(tags);

  update contacts
     set tags = array_remove(tags, tag_name)
   where workspace_id = ws and tag_name = any(tags);

  delete from tags where workspace_id = ws and name = tag_name;
end $$;

-- Enregistre dans le catalogue les tags déjà présents sur les fiches.
-- Indispensable après un import : les tags arrivent dans les colonnes text[]
-- sans jamais passer par le catalogue.
create or replace function sync_workspace_tags(ws uuid)
returns integer language plpgsql security invoker set search_path = public as $$
declare
  inserted integer;
begin
  with found as (
    select distinct btrim(tag) as name
      from (
        select unnest(tags) as tag from companies where workspace_id = ws
        union
        select unnest(tags) as tag from contacts  where workspace_id = ws
      ) t
     where btrim(tag) <> ''
  )
  insert into tags (workspace_id, name)
  select ws, name from found
  on conflict (workspace_id, name) do nothing;

  get diagnostics inserted = row_count;
  return inserted;
end $$;

grant execute on function rename_workspace_tag(uuid, text, text) to authenticated;
grant execute on function delete_workspace_tag(uuid, text)       to authenticated;
grant execute on function sync_workspace_tags(uuid)              to authenticated;

-- Recherche par tag : sans ça, filtrer scanne toute la table.
create index if not exists contacts_tags_gin on contacts using gin (tags);
