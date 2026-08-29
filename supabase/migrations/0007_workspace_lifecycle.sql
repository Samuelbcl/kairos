-- ============================================================================
-- KAIROS — Cycle de vie des espaces (vague 1)
--
-- Deux défauts corrigés ici :
--
-- 1. handle_new_user créait un espace pour TOUT nouveau compte, y compris une
--    personne invitée dans un espace existant. Elle atterrissait avec un espace
--    perso vide en plus, et un sélecteur affichant deux entrées dont une vide.
--
-- 2. Supprimer un compte laissait son espace orphelin : l'appartenance partait
--    en cascade, l'espace restait avec toutes ses données et plus aucun membre
--    capable d'y accéder — ni de les exporter, ni de les effacer.
-- ============================================================================

-- --- 1. Ne pas créer d'espace pour un compte invité -------------------------
-- L'invitation pose `invited_to_workspace` dans les métadonnées du compte ;
-- le trigger s'en sert pour savoir qu'un espace existe déjà pour cette personne.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ws_id uuid;
  pl_id uuid;
  disp  text := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1));
  invited boolean := coalesce((new.raw_user_meta_data->>'invited_to_workspace')::boolean, false);
begin
  insert into profiles(id, full_name) values (new.id, disp);

  -- Personne invitée : son accès viendra de l'espace qui l'a invitée.
  if invited then
    return new;
  end if;

  insert into workspaces(name, slug, created_by)
  values (disp || ' — Espace', 'ws-' || substr(new.id::text,1,8), new.id)
  returning id into ws_id;

  insert into workspace_members(workspace_id, user_id, role)
  values (ws_id, new.id, 'owner');

  insert into pipelines(workspace_id, name, is_default)
  values (ws_id, 'Prospection', true)
  returning id into pl_id;

  insert into stages(workspace_id, pipeline_id, name, color, position, probability, is_won, is_lost) values
    (ws_id, pl_id, 'À contacter',   '#6C8CFF', 0, 10,  false, false),
    (ws_id, pl_id, 'Contacté',      '#F59E0B', 1, 20,  false, false),
    (ws_id, pl_id, 'En discussion', '#EF4444', 2, 45,  false, false),
    (ws_id, pl_id, 'RDV / Devis',   '#8B5CF6', 3, 70,  false, false),
    (ws_id, pl_id, 'Client',        '#22C55E', 4, 100, true,  false),
    (ws_id, pl_id, 'Perdu',         '#94A3B8', 5, 0,   false, true);

  return new;
end $$;

-- --- 2. Un espace sans membre est supprimé ---------------------------------
-- SECURITY DEFINER : le trigger s'exécute pendant la suppression du compte,
-- donc sans session capable de passer la RLS sur workspaces.
create or replace function delete_orphan_workspace()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from workspace_members where workspace_id = old.workspace_id
  ) then
    delete from workspaces where id = old.workspace_id;
  end if;
  return old;
end $$;

drop trigger if exists trg_delete_orphan_workspace on workspace_members;
create trigger trg_delete_orphan_workspace
  after delete on workspace_members
  for each row execute function delete_orphan_workspace();

-- --- 3. Nettoyage des espaces déjà orphelins --------------------------------
delete from workspaces w
where not exists (
  select 1 from workspace_members m where m.workspace_id = w.id
);
