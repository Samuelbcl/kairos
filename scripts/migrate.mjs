/**
 * Applique les migrations non encore passées, dans l'ordre des noms de fichier.
 *
 *   npm run db:migrate            applique ce qui manque
 *   npm run db:migrate -- --list  montre l'état sans rien appliquer
 *
 * Chaque fichier appliqué est inscrit dans schema_migrations avec l'empreinte
 * de son contenu. Sans registre, rejouer une migration échouait et rien ne
 * disait quel schéma tournait sur quel environnement.
 */
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import pg from "pg";

function loadEnv(path = ".env.local") {
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
  return env;
}

const env = loadEnv();
const projectRef = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").match(
  /https:\/\/([a-z0-9]+)\.supabase\.co/,
)?.[1];

if (!projectRef || !env.SUPABASE_DB_PASSWORD) {
  console.error("NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_DB_PASSWORD manquante dans .env.local.");
  process.exit(1);
}

const DIR = "supabase/migrations";
const listOnly = process.argv.includes("--list");

const files = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const client = new pg.Client({
  host: `aws-0-${process.env.SUPABASE_REGION ?? "eu-central-1"}.pooler.supabase.com`,
  port: 5432,
  user: `postgres.${projectRef}`,
  password: env.SUPABASE_DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  statement_timeout: 120_000,
});

await client.connect();

await client.query(`
  create table if not exists schema_migrations (
    version text primary key,
    applied_at timestamptz not null default now(),
    checksum text
  )
`);

const { rows } = await client.query("select version, checksum from schema_migrations");
const applied = new Map(rows.map((r) => [r.version, r.checksum]));

let ran = 0;
let drifted = 0;

for (const file of files) {
  const version = file.replace(/\.sql$/, "");
  const sql = readFileSync(join(DIR, file), "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex").slice(0, 16);

  if (applied.has(version)) {
    const known = applied.get(version);
    // Une migration déjà appliquée mais modifiée depuis : à signaler, jamais
    // à rejouer en silence.
    if (known && known !== checksum) {
      console.log(`  MODIFIÉ  ${version} — le fichier a changé après application`);
      drifted += 1;
    } else {
      console.log(`  déjà     ${version}`);
    }
    continue;
  }

  if (listOnly) {
    console.log(`  À FAIRE  ${version}`);
    continue;
  }

  process.stdout.write(`  …        ${version}`);
  try {
    await client.query(sql);
    await client.query(
      "insert into schema_migrations (version, checksum) values ($1, $2) on conflict (version) do update set checksum = $2",
      [version, checksum],
    );
    process.stdout.write(`\r  APPLIQUÉ ${version}\n`);
    ran += 1;
  } catch (error) {
    process.stdout.write(`\r  ÉCHEC    ${version}\n`);
    console.error(`\n${error.message}`);
    if (error.position) console.error(`  position ${error.position}`);
    await client.end();
    process.exit(1);
  }
}

// Rattrape les empreintes des migrations inscrites avant l'existence du registre.
for (const file of files) {
  const version = file.replace(/\.sql$/, "");
  if (applied.get(version) === null) {
    const sql = readFileSync(join(DIR, file), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex").slice(0, 16);
    await client.query("update schema_migrations set checksum = $2 where version = $1", [
      version,
      checksum,
    ]);
  }
}

await client.end();

console.log(
  listOnly
    ? "\nAucune modification appliquée (--list)."
    : `\n${ran} migration(s) appliquée(s), ${files.length - ran} déjà en place.`,
);
if (drifted > 0) {
  console.log(
    `${drifted} fichier(s) modifié(s) après application : crée une nouvelle migration plutôt que d'éditer l'ancienne.`,
  );
}
