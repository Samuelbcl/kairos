-- ============================================================================
-- KAIROS — Favicon par espace et envois plus tolérants
--
-- Deux refus rencontrés à l'usage :
--   1. un fichier .ico est servi en image/x-icon, absent de la liste autorisée,
--      donc rejeté — alors que c'est le format historique du favicon ;
--   2. la limite de 2 Mo écartait des logos exportés sans compression.
--
-- La compression se fait maintenant dans le navigateur avant l'envoi : on peut
-- accepter un fichier d'entrée plus gros sans rien stocker de lourd.
-- ============================================================================

update storage.buckets
   set file_size_limit = 8388608,  -- 8 Mo à l'entrée ; ce qui est stocké est compressé
       allowed_mime_types = array[
         'image/png',
         'image/jpeg',
         'image/webp',
         'image/svg+xml',
         'image/gif',
         'image/avif',
         'image/x-icon',
         'image/vnd.microsoft.icon'
       ]
 where id = 'workspace-files';

comment on column workspaces.branding is
  'Marque blanche : brand_name, logo_url, favicon_url, accent, radius, mode.';
