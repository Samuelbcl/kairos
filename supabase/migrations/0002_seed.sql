-- ============================================================================
-- KAIROS — Seed de démonstration (optionnel)
-- Les 202 entreprises de Biancola s'importent via l'UI (Import CSV) une fois
-- l'app en place. Ce seed sert juste à avoir de quoi cliquer en dev.
--
-- Mode d'emploi : après avoir créé un compte (ce qui crée automatiquement ton
-- workspace + pipeline + étapes), récupère l'id de ton workspace :
--   select id, name from workspaces;
-- puis remplace la valeur ci-dessous et exécute ce fichier.
-- ============================================================================

do $$
declare
  ws        uuid := '00000000-0000-0000-0000-000000000000';  -- ← REMPLACE
  pl        uuid;
  st_new    uuid; st_contacted uuid; st_discuss uuid;
  c1 uuid; c2 uuid; c3 uuid;
begin
  select id into pl from pipelines where workspace_id = ws and is_default limit 1;
  select id into st_new       from stages where pipeline_id = pl and position = 0;
  select id into st_contacted from stages where pipeline_id = pl and position = 1;
  select id into st_discuss   from stages where pipeline_id = pl and position = 2;

  insert into companies(workspace_id, name, email, sector, city, source) values
    (ws, 'Menuiserie Dupont', 'info@menuiserie-dupont.be', 'Menuiserie', 'Liège', 'manual') returning id into c1;
  insert into companies(workspace_id, name, email, sector, city, source) values
    (ws, 'Boucha Group', 'info@boucha.be', 'Industrie', 'Herstal', 'import') returning id into c2;
  insert into companies(workspace_id, name, email, sector, city, source) values
    (ws, 'Electro-Test', null, 'Électronique', 'Seraing', 'import') returning id into c3;

  -- Deals dans le pipeline
  insert into deals(workspace_id, pipeline_id, stage_id, company_id, title, priority, last_activity_at) values
    (ws, pl, st_new,       c1, 'Site vitrine Menuiserie Dupont', 'high',   now()),
    (ws, pl, st_contacted, c2, 'Refonte site Boucha Group',      'normal', now() - interval '6 days'),
    (ws, pl, st_discuss,   c3, 'Outil interne Electro-Test',     'normal', now() - interval '2 days');

  -- Une relance en retard (pour tester la vue « Aujourd'hui »)
  insert into tasks(workspace_id, title, kind, due_at, company_id, priority) values
    (ws, 'Relancer Boucha Group', 'follow_up', now() - interval '1 day', c2, 'high');

  raise notice 'Seed inséré pour le workspace %', ws;
end $$;
