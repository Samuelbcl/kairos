-- ============================================================================
-- KAIROS — Schéma initial (Postgres / Supabase)
-- Multi-tenant par workspace, RLS stricte, région eu-central-1.
-- À exécuter dans SQL Editor (ou `supabase db push`).
-- ============================================================================

create extension if not exists pgcrypto;      -- gen_random_uuid()
create extension if not exists pg_trgm;        -- recherche floue (LIKE / similarité)

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
create type member_role         as enum ('owner', 'admin', 'member');
create type deal_status         as enum ('open', 'won', 'lost');
create type priority_level      as enum ('low', 'normal', 'high');
create type activity_type       as enum ('note', 'email', 'call', 'meeting', 'task', 'stage_change', 'system');
create type task_kind           as enum ('follow_up', 'call', 'email', 'meeting', 'todo');
create type integration_provider as enum ('google', 'microsoft');
create type custom_entity       as enum ('company', 'contact', 'deal');
create type custom_field_type   as enum ('text', 'number', 'date', 'select', 'checkbox', 'url', 'email', 'phone');

-- ----------------------------------------------------------------------------
-- PROFILES (miroir de auth.users)
-- ----------------------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table profiles is 'Profil applicatif lié à un utilisateur Supabase Auth.';

-- ----------------------------------------------------------------------------
-- WORKSPACES (le tenant) + branding/thème
-- ----------------------------------------------------------------------------
create table workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  -- branding white-label : { brand_name, logo_url, accent, radius, mode }
  branding    jsonb not null default '{"accent":"#4F46E5","radius":"0.75rem","mode":"light"}'::jsonb,
  timezone    text not null default 'Europe/Brussels',
  plan        text not null default 'free',
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table workspaces is 'Espace de travail = un client. Contient son branding et ses réglages.';

create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         member_role not null default 'member',
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index on workspace_members(user_id);

-- ----------------------------------------------------------------------------
-- Fonctions d'appartenance (SECURITY DEFINER pour éviter la récursion RLS)
-- ----------------------------------------------------------------------------
create or replace function is_workspace_member(ws uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

create or replace function is_workspace_admin(ws uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws and user_id = auth.uid() and role in ('owner','admin')
  );
$$;

grant execute on function is_workspace_member(uuid) to authenticated;
grant execute on function is_workspace_admin(uuid)  to authenticated;

-- ----------------------------------------------------------------------------
-- PIPELINES & STAGES (étapes personnalisables + couleurs)
-- ----------------------------------------------------------------------------
create table pipelines (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null default 'Prospection',
  is_default   boolean not null default true,
  created_at   timestamptz not null default now()
);
create index on pipelines(workspace_id);

create table stages (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  pipeline_id  uuid not null references pipelines(id) on delete cascade,
  name         text not null,
  color        text not null default '#6C8CFF',   -- personnalisable
  position     int  not null default 0,
  probability  int  not null default 0,           -- 0..100, pour prévisions
  is_won       boolean not null default false,
  is_lost      boolean not null default false,
  created_at   timestamptz not null default now()
);
create index on stages(workspace_id);
create index on stages(pipeline_id, position);

-- ----------------------------------------------------------------------------
-- TAGS (catalogue par espace, pour couleurs)
-- ----------------------------------------------------------------------------
create table tags (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  color        text not null default '#94A3B8',
  unique (workspace_id, name)
);
create index on tags(workspace_id);

-- ----------------------------------------------------------------------------
-- CHAMPS PERSONNALISÉS (modularité) — valeurs stockées dans .custom (jsonb)
-- ----------------------------------------------------------------------------
create table custom_fields (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  entity       custom_entity not null,
  key          text not null,                      -- ex: 'siret'
  label        text not null,                       -- ex: 'N° BCE'
  type         custom_field_type not null default 'text',
  options      jsonb,                               -- pour 'select'
  position     int not null default 0,
  unique (workspace_id, entity, key)
);
create index on custom_fields(workspace_id, entity);

-- ----------------------------------------------------------------------------
-- COMPANIES (comptes / entreprises)
-- ----------------------------------------------------------------------------
create table companies (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  email        text,
  phone        text,
  website      text,
  sector       text,
  address      text,
  city         text,
  country      text default 'BE',
  size         text,                                -- '1-10', '11-50', …
  tags         text[] not null default '{}',
  custom       jsonb  not null default '{}'::jsonb,
  owner_id     uuid references auth.users(id) on delete set null,
  source       text,                                -- 'import', 'manual', 'form', …
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on companies(workspace_id);
create index on companies using gin (name gin_trgm_ops);
create index on companies using gin (tags);

-- ----------------------------------------------------------------------------
-- CONTACTS (personnes, rattachées à une company)
-- ----------------------------------------------------------------------------
create table contacts (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id   uuid references companies(id) on delete set null,
  first_name   text,
  last_name    text,
  email        text,
  phone        text,
  role_title   text,                                -- fonction
  tags         text[] not null default '{}',
  custom       jsonb  not null default '{}'::jsonb,
  owner_id     uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on contacts(workspace_id);
create index on contacts(company_id);
create index on contacts using gin ((coalesce(first_name,'') || ' ' || coalesce(last_name,'')) gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- DEALS (opportunités dans le pipeline)
-- ----------------------------------------------------------------------------
create table deals (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  pipeline_id   uuid not null references pipelines(id) on delete cascade,
  stage_id      uuid not null references stages(id) on delete restrict,
  company_id    uuid references companies(id) on delete set null,
  contact_id    uuid references contacts(id) on delete set null,
  title         text not null,
  value         numeric(12,2) default 0,
  currency      text not null default 'EUR',
  priority      priority_level not null default 'normal',
  status        deal_status not null default 'open',
  expected_close date,
  last_activity_at timestamptz,                     -- pour détecter les deals « qui dorment »
  owner_id      uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on deals(workspace_id);
create index on deals(workspace_id, stage_id);
create index on deals(workspace_id, status);
create index on deals(last_activity_at);

-- ----------------------------------------------------------------------------
-- ACTIVITIES (timeline polymorphe : company / contact / deal)
-- ----------------------------------------------------------------------------
create table activities (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  subject_type custom_entity not null,              -- company | contact | deal
  subject_id   uuid not null,
  type         activity_type not null default 'note',
  content      text,
  meta         jsonb not null default '{}'::jsonb,  -- {from_stage, to_stage, email_id…}
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index on activities(workspace_id);
create index on activities(subject_type, subject_id, created_at desc);

-- ----------------------------------------------------------------------------
-- TASKS (relances = objet central du produit)
-- ----------------------------------------------------------------------------
create table tasks (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  title         text not null,
  kind          task_kind not null default 'follow_up',
  notes         text,
  due_at        timestamptz not null,
  remind_at     timestamptz,                        -- rappel avant l'échéance
  done          boolean not null default false,
  done_at       timestamptz,
  priority      priority_level not null default 'normal',
  -- rattachements (au moins un, en pratique)
  company_id    uuid references companies(id) on delete cascade,
  contact_id    uuid references contacts(id) on delete cascade,
  deal_id       uuid references deals(id) on delete cascade,
  assignee_id   uuid references auth.users(id) on delete set null,
  -- synchronisation calendrier (idempotence)
  calendar_provider integration_provider,
  external_event_id text,                           -- id de l'événement Google/MS
  calendar_synced_at timestamptz,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on tasks(workspace_id);
create index on tasks(workspace_id, due_at) where done = false;   -- vue « à faire »
create index on tasks(assignee_id) where done = false;
create index on tasks(deal_id);

-- ----------------------------------------------------------------------------
-- INTEGRATIONS (tokens OAuth chiffrés — 1 par user et par provider)
-- ----------------------------------------------------------------------------
create table integrations (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references workspaces(id) on delete cascade,
  user_id            uuid not null references auth.users(id) on delete cascade,
  provider           integration_provider not null,
  account_email      text,
  access_token_enc   text not null,                 -- AES-GCM (lib/crypto.ts)
  refresh_token_enc  text,
  scopes             text[] not null default '{}',
  expires_at         timestamptz,
  calendar_id        text default 'primary',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (workspace_id, user_id, provider)
);
create index on integrations(workspace_id);
-- Sécurité : cette table n'est JAMAIS lue côté client (tokens). Accès service_role uniquement.

-- ----------------------------------------------------------------------------
-- AUTOMATIONS (moteur « quand X → faire Y ») — voir docs/AUTOMATIONS.md
-- ----------------------------------------------------------------------------
create table automations (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  enabled      boolean not null default true,
  trigger      jsonb not null,     -- { event: 'task.created', ... }
  conditions   jsonb not null default '[]'::jsonb,
  actions      jsonb not null,     -- [ { type:'calendar.create_event', ... }, ... ]
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on automations(workspace_id) where enabled = true;

create table automation_runs (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  automation_id uuid references automations(id) on delete set null,
  status        text not null default 'success',   -- success | error
  detail        jsonb,
  created_at    timestamptz not null default now()
);
create index on automation_runs(workspace_id, created_at desc);

-- ----------------------------------------------------------------------------
-- WEBHOOKS sortants + CLÉS API (connecter n'importe quelle app)
-- ----------------------------------------------------------------------------
create table webhooks (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  url          text not null,
  events       text[] not null default '{}',        -- ['deal.stage_changed', …]
  secret       text not null,                        -- signature HMAC
  enabled      boolean not null default true,
  created_at   timestamptz not null default now()
);
create index on webhooks(workspace_id) where enabled = true;

create table api_keys (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  key_hash     text not null,                        -- hash de la clé (jamais en clair)
  prefix       text not null,                        -- 4 premiers car. pour l'affichage
  last_used_at timestamptz,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index on api_keys(workspace_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- updated_at automatique
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','workspaces','companies','contacts','deals','tasks','integrations','automations'
  ] loop
    execute format(
      'create trigger trg_%1$s_updated before update on %1$s
       for each row execute function set_updated_at();', t);
  end loop;
end $$;

-- Nouvel utilisateur → profil + workspace perso + membership owner + pipeline + étapes
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ws_id uuid;
  pl_id uuid;
  disp  text := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1));
begin
  insert into profiles(id, full_name) values (new.id, disp);

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Changement d'étape d'un deal → entrée timeline + maj last_activity_at
create or replace function log_deal_stage_change()
returns trigger language plpgsql as $$
begin
  if new.stage_id is distinct from old.stage_id then
    insert into activities(workspace_id, subject_type, subject_id, type, content, meta, created_by)
    values (new.workspace_id, 'deal', new.id, 'stage_change', null,
            jsonb_build_object('from', old.stage_id, 'to', new.stage_id), auth.uid());
    new.last_activity_at = now();
    -- statut auto si l'étape est gagnée/perdue
    if exists (select 1 from stages where id = new.stage_id and is_won)  then new.status = 'won';
    elsif exists (select 1 from stages where id = new.stage_id and is_lost) then new.status = 'lost';
    else new.status = 'open';
    end if;
  end if;
  return new;
end $$;

create trigger trg_deal_stage_change before update on deals
  for each row execute function log_deal_stage_change();

-- Tâche terminée → timeline sur le rattachement principal
create or replace function log_task_done()
returns trigger language plpgsql as $$
declare sid uuid; stype custom_entity;
begin
  if new.done and not old.done then
    new.done_at = now();
    if    new.deal_id    is not null then stype := 'deal';    sid := new.deal_id;
    elsif new.contact_id is not null then stype := 'contact'; sid := new.contact_id;
    elsif new.company_id is not null then stype := 'company'; sid := new.company_id;
    end if;
    if sid is not null then
      insert into activities(workspace_id, subject_type, subject_id, type, content, created_by)
      values (new.workspace_id, stype, sid, 'task', 'Tâche terminée : ' || new.title, auth.uid());
    end if;
  end if;
  return new;
end $$;

create trigger trg_task_done before update on tasks
  for each row execute function log_task_done();

-- ============================================================================
-- RLS — tout est fermé par défaut, on ouvre par appartenance au workspace
-- ============================================================================
alter table profiles          enable row level security;
alter table workspaces         enable row level security;
alter table workspace_members  enable row level security;
alter table pipelines          enable row level security;
alter table stages             enable row level security;
alter table tags               enable row level security;
alter table custom_fields      enable row level security;
alter table companies          enable row level security;
alter table contacts           enable row level security;
alter table deals              enable row level security;
alter table activities         enable row level security;
alter table tasks              enable row level security;
alter table integrations       enable row level security;
alter table automations        enable row level security;
alter table automation_runs    enable row level security;
alter table webhooks           enable row level security;
alter table api_keys           enable row level security;

-- profiles : je vois/édite le mien ; je vois ceux qui partagent un de mes espaces
create policy "profil : soi-même (read)"  on profiles for select using (id = auth.uid());
create policy "profil : soi-même (write)" on profiles for update using (id = auth.uid());
create policy "profil : collègues" on profiles for select using (
  exists (
    select 1 from workspace_members m1
    join workspace_members m2 on m1.workspace_id = m2.workspace_id
    where m1.user_id = auth.uid() and m2.user_id = profiles.id
  )
);

-- workspaces : membres en lecture ; admins en écriture ; tout authentifié peut créer
create policy "ws : membres (read)"   on workspaces for select using (is_workspace_member(id));
create policy "ws : créer"            on workspaces for insert with check (created_by = auth.uid());
create policy "ws : admin (update)"   on workspaces for update using (is_workspace_admin(id));
create policy "ws : owner (delete)"   on workspaces for delete using (
  exists (select 1 from workspace_members where workspace_id = id and user_id = auth.uid() and role = 'owner')
);

-- workspace_members : membres voient la liste ; admins gèrent
create policy "membres : lire"   on workspace_members for select using (is_workspace_member(workspace_id));
create policy "membres : gérer"  on workspace_members for all
  using (is_workspace_admin(workspace_id)) with check (is_workspace_admin(workspace_id));

-- Macro : mêmes 4 policies « membre » pour toutes les tables métier
do $$
declare t text;
begin
  foreach t in array array[
    'pipelines','stages','tags','custom_fields','companies','contacts',
    'deals','activities','tasks','automations','automation_runs','webhooks'
  ] loop
    execute format($f$
      create policy "%1$s : lire"     on %1$s for select using (is_workspace_member(workspace_id));
      create policy "%1$s : créer"    on %1$s for insert with check (is_workspace_member(workspace_id));
      create policy "%1$s : modifier" on %1$s for update using (is_workspace_member(workspace_id));
      create policy "%1$s : suppr"    on %1$s for delete using (is_workspace_member(workspace_id));
    $f$, t);
  end loop;
end $$;

-- api_keys : admins seulement (contiennent des secrets)
create policy "api_keys : admin" on api_keys for all
  using (is_workspace_admin(workspace_id)) with check (is_workspace_admin(workspace_id));

-- integrations : chaque user gère SES connexions ; jamais lisible côté client autrement.
-- (les tokens sont manipulés par le serveur via service_role, qui bypass la RLS)
create policy "integrations : soi-même" on integrations for all
  using (user_id = auth.uid() and is_workspace_member(workspace_id))
  with check (user_id = auth.uid() and is_workspace_member(workspace_id));

-- Fin 0001_init.sql
