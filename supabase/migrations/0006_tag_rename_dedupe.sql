-- ============================================================================
-- KAIROS — Déduplication au renommage de tag
--
-- array_replace remplace chaque occurrence sans dédupliquer : renommer
-- « energie » en « À rappeler » sur une fiche qui portait déjà « À rappeler »
-- produisait ["À rappeler", "À rappeler"]. Invisible à l'œil (deux badges
-- identiques), mais faux en base et dans les exports.
--
-- On déduplique en conservant l'ordre de première apparition.
-- ============================================================================

create or replace function rename_workspace_tag(ws uuid, old_name text, new_name text)
returns void language plpgsql security invoker set search_path = public as $$
declare
  target text := btrim(new_name);
begin
  if target = '' then
    raise exception 'Le nouveau nom ne peut pas être vide';
  end if;

  update companies
     set tags = coalesce((
       select array_agg(t order by ord)
         from (
           select t, min(ord) as ord
             from unnest(array_replace(tags, old_name, target)) with ordinality as u(t, ord)
            group by t
         ) d
     ), '{}')
   where workspace_id = ws and old_name = any(tags);

  update contacts
     set tags = coalesce((
       select array_agg(t order by ord)
         from (
           select t, min(ord) as ord
             from unnest(array_replace(tags, old_name, target)) with ordinality as u(t, ord)
            group by t
         ) d
     ), '{}')
   where workspace_id = ws and old_name = any(tags);

  -- Si la cible existe déjà, les deux entrées de catalogue fusionnent.
  if exists (select 1 from tags where workspace_id = ws and name = target) then
    delete from tags where workspace_id = ws and name = old_name;
  else
    update tags set name = target where workspace_id = ws and name = old_name;
  end if;
end $$;

grant execute on function rename_workspace_tag(uuid, text, text) to authenticated;
