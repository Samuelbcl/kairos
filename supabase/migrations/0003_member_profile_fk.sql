-- ============================================================================
-- KAIROS — Lien workspace_members → profiles
--
-- Problème : workspace_members.user_id et profiles.id référencent tous deux
-- auth.users(id), mais aucune clé étrangère ne les relie directement. PostgREST
-- refuse donc l'imbrication `profiles(...)` depuis `workspace_members`, ce qui
-- casse toute page voulant afficher le nom d'un membre.
--
-- Correctif : une clé étrangère redondante mais explicite vers profiles.
-- L'ordre est sûr — handle_new_user insère le profil avant l'appartenance.
-- ============================================================================

alter table workspace_members
  add constraint workspace_members_user_id_profiles_fkey
  foreign key (user_id) references profiles(id) on delete cascade;

comment on constraint workspace_members_user_id_profiles_fkey on workspace_members is
  'Permet à PostgREST d''imbriquer profiles depuis workspace_members (affichage des noms).';
