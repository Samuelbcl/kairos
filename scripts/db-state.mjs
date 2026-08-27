/** Inventaire rapide du schéma public : tables, enums, fonctions, triggers, policies. */
import { readFileSync } from "node:fs";
import pg from "pg";

function loadEnv(path = ".env.local") {
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (!match) continue;
    env[match[1]] = match[2].replace(/^"(.*)"$/, "$1");
  }
  return env;
}

const env = loadEnv();
const projectRef = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").match(
  /https:\/\/([a-z0-9]+)\.supabase\.co/,
)?.[1];

const client = new pg.Client({
  host: `aws-0-${process.env.SUPABASE_REGION ?? "eu-central-1"}.pooler.supabase.com`,
  port: 5432,
  user: `postgres.${projectRef}`,
  password: env.SUPABASE_DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

const queries = {
  tables:
    "select tablename from pg_tables where schemaname='public' order by tablename",
  enums:
    "select t.typname from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype='e' order by 1",
  fonctions:
    "select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1",
  triggers:
    "select tgname from pg_trigger where not tgisinternal order by 1",
  policies:
    "select count(*)::text as n from pg_policies where schemaname='public'",
  rls_actives:
    "select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity order by 1",
};

await client.connect();
for (const [label, sql] of Object.entries(queries)) {
  const { rows } = await client.query(sql);
  const values = rows.map((r) => Object.values(r)[0]);
  console.log(`\n${label} (${values.length}) :`);
  console.log(values.length ? `  ${values.join(", ")}` : "  (aucun)");
}
await client.end();
