-- ============================================================================
-- KAIROS — Plans, usage et domaines (vague 3)
--
-- La colonne `plan` existait sans que rien ne la lise : aucune limite, aucun
-- compteur, donc rien à facturer et rien qui distingue une offre à 19 € d'une
-- offre à 49 €. Et un seul domaine pour tous les clients.
-- ============================================================================

-- --- Plans ------------------------------------------------------------------
create table if not exists plans (
  id              text primary key,
  name            text not null,
  max_members     int,          -- null = illimité
  max_companies   int,
  max_automations int,
  price_eur       int not null default 0,
  position        int not null default 0
);

insert into plans (id, name, max_members, max_companies, max_automations, price_eur, position) values
  ('free',  'Découverte', 1,    200,   2,    0,  0),
  ('solo',  'Solo',       2,    2000,  10,   19, 1),
  ('team',  'Équipe',     10,   20000, 50,   49, 2),
  ('scale', 'Sur mesure', null, null,  null, 0,  3)
on conflict (id) do update
  set name = excluded.name,
      max_members = excluded.max_members,
      max_companies = excluded.max_companies,
      max_automations = excluded.max_automations,
      price_eur = excluded.price_eur,
      position = excluded.position;

alter table plans enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'plans') then
    -- Le catalogue est public pour tout compte connecté : il faut bien pouvoir
    -- montrer vers quoi on peut monter.
    create policy "plans : lire" on plans for select to authenticated using (true);
  end if;
end $$;

alter table workspaces
  add column if not exists plan_id text references plans(id) on delete set null;

update workspaces set plan_id = coalesce(plan_id, 'free') where plan_id is null;

-- --- Usage ------------------------------------------------------------------
-- Compté à la demande plutôt que maintenu par triggers : sur ces volumes, un
-- count() coûte moins cher qu'un compteur qui dérive et qu'il faut réparer.
create or replace function workspace_usage(ws uuid)
returns table (members int, companies int, automations int, tasks_open int)
language sql security invoker stable set search_path = public as $$
  select
    (select count(*)::int from workspace_members where workspace_id = ws),
    (select count(*)::int from companies where workspace_id = ws and deleted_at is null),
    (select count(*)::int from automations where workspace_id = ws and enabled),
    (select count(*)::int from tasks where workspace_id = ws and not done);
$$;

grant execute on function workspace_usage(uuid) to authenticated;

-- --- Un domaine par client --------------------------------------------------
create table if not exists workspace_domains (
  host         text primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  verified_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists workspace_domains_ws_idx on workspace_domains(workspace_id);

comment on table workspace_domains is
  'Nom d''hôte → espace. Permet client.ton-crm.be ou un domaine à eux.';

alter table workspace_domains enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'workspace_domains') then
    create policy "domaines : lire"  on workspace_domains for select
      using (is_workspace_member(workspace_id));
    create policy "domaines : gérer" on workspace_domains for all
      using (is_workspace_admin(workspace_id)) with check (is_workspace_admin(workspace_id));
  end if;
end $$;

-- Résolution sans session : le proxy interroge avant même de connaître l'user.
create or replace function workspace_for_host(candidate text)
returns uuid language sql security definer stable set search_path = public as $$
  select workspace_id from workspace_domains
   where host = lower(candidate) and verified_at is not null
   limit 1;
$$;

grant execute on function workspace_for_host(text) to anon, authenticated;
