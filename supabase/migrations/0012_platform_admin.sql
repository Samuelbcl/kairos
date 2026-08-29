-- ============================================================================
-- KAIROS — Console d'éditeur (vague 2)
--
-- La RLS exclut l'éditeur des données de ses clients : c'est voulu et c'est
-- bien. Mais quand un client écrit « ça ne marche pas », il n'y a aucun moyen
-- de regarder — chaque incident se règle par capture d'écran interposée.
--
-- On ajoute une liste explicite d'administrateurs de la plateforme. Elle ne
-- donne accès à AUCUNE donnée client : la console lit des compteurs et des
-- dates, jamais le contenu des fiches. Voir un espace client suppose un accès
-- accordé par lui, tracé, et limité dans le temps.
-- ============================================================================

create table if not exists platform_admins (
  user_id    uuid primary key references profiles(id) on delete cascade,
  note       text,
  created_at timestamptz not null default now()
);

comment on table platform_admins is
  'Éditeur de la plateforme. Accès aux métriques des espaces, jamais à leur contenu.';

alter table platform_admins enable row level security;

-- Chacun voit seulement s'il en fait partie ; l'ajout se fait en SQL, jamais
-- depuis l'application : on ne s'auto-promeut pas administrateur.
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'platform_admins') then
    create policy "éditeur : soi-même" on platform_admins for select
      using (user_id = auth.uid());
  end if;
end $$;

create or replace function is_platform_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$;

grant execute on function is_platform_admin() to authenticated;

-- Journal des consultations : un accès de support doit laisser une trace.
create table if not exists admin_access_log (
  id           uuid primary key default gen_random_uuid(),
  admin_id     uuid references profiles(id) on delete set null,
  workspace_id uuid references workspaces(id) on delete cascade,
  action       text not null,
  created_at   timestamptz not null default now()
);
create index if not exists admin_access_log_idx on admin_access_log(created_at desc);

alter table admin_access_log enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'admin_access_log') then
    create policy "journal : éditeur" on admin_access_log for select
      using (is_platform_admin());
  end if;
end $$;
