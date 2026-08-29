-- ============================================================================
-- KAIROS — Fondations de la vague 2
--
-- Trois manques identifiés à l'audit :
--   1. les corps d'e-mail vivaient dans le JSON d'une règle d'automatisation,
--      donc ni réutilisables, ni prévisualisables, ni modifiables ailleurs ;
--   2. un webhook en échec était écrit dans les logs serveur et oublié : le
--      client ne voyait rien et ne pouvait rien rejouer ;
--   3. aucun registre des migrations : rejouer un fichier échouait, et rien
--      ne disait quel schéma tournait sur quel environnement.
-- ============================================================================

-- --- 1. Modèles d'e-mail ----------------------------------------------------
create table if not exists email_templates (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  subject      text not null default '',
  body         text not null default '',
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, name)
);
create index if not exists email_templates_workspace_idx on email_templates(workspace_id);

alter table email_templates enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'email_templates') then
    create policy "modèles : lire"     on email_templates for select using (is_workspace_member(workspace_id));
    create policy "modèles : créer"    on email_templates for insert with check (is_workspace_member(workspace_id));
    create policy "modèles : modifier" on email_templates for update using (is_workspace_member(workspace_id));
    create policy "modèles : suppr"    on email_templates for delete using (is_workspace_member(workspace_id));
  end if;
end $$;

drop trigger if exists trg_email_templates_updated on email_templates;
create trigger trg_email_templates_updated before update on email_templates
  for each row execute function set_updated_at();

-- --- 2. Journal des livraisons de webhooks ---------------------------------
create table if not exists webhook_deliveries (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  webhook_id    uuid references webhooks(id) on delete cascade,
  event         text not null,
  payload       jsonb not null default '{}'::jsonb,
  status        text not null default 'pending',   -- pending | success | failed
  status_code   int,
  error         text,
  attempts      int not null default 0,
  next_retry_at timestamptz,
  delivered_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists webhook_deliveries_workspace_idx
  on webhook_deliveries(workspace_id, created_at desc);
-- Le cron ne relit que ce qui reste à retenter.
create index if not exists webhook_deliveries_retry_idx
  on webhook_deliveries(next_retry_at)
  where status = 'failed' and next_retry_at is not null;

alter table webhook_deliveries enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'webhook_deliveries') then
    create policy "livraisons : lire"  on webhook_deliveries for select using (is_workspace_member(workspace_id));
    create policy "livraisons : gérer" on webhook_deliveries for all
      using (is_workspace_admin(workspace_id)) with check (is_workspace_admin(workspace_id));
  end if;
end $$;

-- --- 3. Registre des migrations --------------------------------------------
-- Sans lui, rejouer 0001 échoue et rien ne dit quel schéma tourne où.
create table if not exists schema_migrations (
  version    text primary key,
  applied_at timestamptz not null default now(),
  checksum   text
);

comment on table schema_migrations is
  'Migrations déjà appliquées. Alimenté par scripts/migrate.mjs.';

-- Les migrations posées avant l'existence du registre sont marquées comme
-- appliquées : elles le sont, et les rejouer casserait.
insert into schema_migrations (version) values
  ('0001_init'),
  ('0002_seed'),
  ('0003_member_profile_fk'),
  ('0004_profile_relations'),
  ('0005_tag_management'),
  ('0006_tag_rename_dedupe'),
  ('0007_workspace_lifecycle'),
  ('0008_shared_calendar'),
  ('0009_soft_delete'),
  ('0010_wave2_foundations')
on conflict (version) do nothing;
