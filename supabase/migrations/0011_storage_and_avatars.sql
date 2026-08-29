-- ============================================================================
-- KAIROS — Envoi de fichiers (vague 2)
--
-- Le branding n'acceptait qu'une URL de logo : inutilisable pour un client dont
-- le fichier est sur son bureau. Un seul bucket privé, cloisonné par espace via
-- le premier segment du chemin — `<workspace_id>/logo/…`.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workspace-files',
  'workspace-files',
  false,
  2097152,  -- 2 Mo : au-delà, c'est une image non compressée
  array['image/png','image/jpeg','image/webp','image/svg+xml']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Le premier segment du chemin est l'identifiant de l'espace : l'appartenance
-- décide de tout, comme partout ailleurs dans Kairos.
drop policy if exists "fichiers : lire"     on storage.objects;
drop policy if exists "fichiers : envoyer"  on storage.objects;
drop policy if exists "fichiers : remplacer" on storage.objects;
drop policy if exists "fichiers : suppr"    on storage.objects;

create policy "fichiers : lire" on storage.objects for select
  using (
    bucket_id = 'workspace-files'
    and is_workspace_member(((storage.foldername(name))[1])::uuid)
  );

create policy "fichiers : envoyer" on storage.objects for insert
  with check (
    bucket_id = 'workspace-files'
    and is_workspace_member(((storage.foldername(name))[1])::uuid)
  );

create policy "fichiers : remplacer" on storage.objects for update
  using (
    bucket_id = 'workspace-files'
    and is_workspace_member(((storage.foldername(name))[1])::uuid)
  );

create policy "fichiers : suppr" on storage.objects for delete
  using (
    bucket_id = 'workspace-files'
    and is_workspace_member(((storage.foldername(name))[1])::uuid)
  );

-- Photo de contact : le CRM était jusqu'ici entièrement sans visage.
alter table contacts add column if not exists avatar_url text;
