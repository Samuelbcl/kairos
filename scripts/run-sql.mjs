/**
 * Exécute un fichier .sql sur la base Supabase du projet.
 *
 *   node scripts/run-sql.mjs supabase/migrations/0001_init.sql
 *
 * Lit la connexion depuis .env.local (NEXT_PUBLIC_SUPABASE_URL pour la référence
 * du projet, SUPABASE_DB_PASSWORD pour le mot de passe Postgres). Passe par le
 * pooler en mode session : l'hôte direct db.<ref>.supabase.co est en IPv6 seul.
 *
 * Le fichier est envoyé d'un bloc, donc dans une seule transaction implicite :
 * si une instruction échoue, rien n'est appliqué.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

const file = process.argv[2];
if (!file) {
  console.error("Usage : node scripts/run-sql.mjs <fichier.sql>");
  process.exit(1);
}

const env = loadEnv();
const projectRef = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").match(
  /https:\/\/([a-z0-9]+)\.supabase\.co/,
)?.[1];
const password = env.SUPABASE_DB_PASSWORD;
const region = process.env.SUPABASE_REGION ?? "eu-central-1";

if (!projectRef || !password) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_DB_PASSWORD manquante dans .env.local.",
  );
  process.exit(1);
}

const sql = readFileSync(resolve(file), "utf8");

const client = new pg.Client({
  host: `aws-0-${region}.pooler.supabase.com`,
  port: 5432, // mode session : requis pour le DDL
  user: `postgres.${projectRef}`,
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  statement_timeout: 120_000,
});

try {
  await client.connect();
  console.log(`Connecté au projet ${projectRef} (${region}).`);
  console.log(`Exécution de ${file} …`);
  await client.query(sql);
  console.log("Terminé sans erreur.");
} catch (error) {
  console.error(`\nÉCHEC : ${error.message}`);
  if (error.position) console.error(`  position ${error.position}`);
  if (error.hint) console.error(`  piste : ${error.hint}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
