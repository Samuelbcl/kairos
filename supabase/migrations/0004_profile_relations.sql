-- ============================================================================
-- KAIROS — Relier à profiles toutes les colonnes qui désignent un utilisateur
--
-- Même cause que 0003 : ces colonnes référencent auth.users, table que PostgREST
-- n'expose pas. Sans clé étrangère vers profiles, impossible d'afficher le nom
-- de l'auteur d'une note, du responsable d'une relance, du propriétaire d'un
-- deal — l'imbrication échoue à l'exécution.
--
-- Les contraintes sont nommées explicitement : plusieurs colonnes d'une même
-- table pointent vers profiles (tasks.assignee_id et tasks.created_by), il faut
-- donc pouvoir désambiguïser côté requête —
--   .select("profiles!tasks_assignee_id_profiles_fkey(full_name)")
--
-- `on delete set null` pour rester cohérent avec les clés existantes vers
-- auth.users : supprimer un compte ne détruit pas l'historique qu'il a produit.
-- ============================================================================

do $$
declare
  target record;
begin
  for target in
    select * from (values
      ('activities',  'created_by'),
      ('companies',   'owner_id'),
      ('contacts',    'owner_id'),
      ('deals',       'owner_id'),
      ('tasks',       'assignee_id'),
      ('tasks',       'created_by'),
      ('automations', 'created_by'),
      ('api_keys',    'created_by'),
      ('workspaces',  'created_by')
    ) as t(table_name, column_name)
  loop
    if not exists (
      select 1 from pg_constraint
      where conname = format('%s_%s_profiles_fkey', target.table_name, target.column_name)
    ) then
      execute format(
        'alter table %I add constraint %I foreign key (%I) references profiles(id) on delete set null',
        target.table_name,
        format('%s_%s_profiles_fkey', target.table_name, target.column_name),
        target.column_name
      );
    end if;
  end loop;
end $$;
