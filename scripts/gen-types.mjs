/**
 * Génère src/types/db.ts depuis la base distante.
 *
 *   npm run db:types
 *
 * Passe par l'API Management de Supabase plutôt que par la CLI : depuis la v2,
 * `supabase gen types` lance un conteneur pg-meta et exige donc Docker.
 * L'API fait le même travail avec un simple appel HTTP.
 *
 * Nécessite SUPABASE_ACCESS_TOKEN dans .env.local — un Personal Access Token
 * créé sur https://supabase.com/dashboard/account/tokens (révocable à tout moment).
 */
import { readFileSync, writeFileSync } from "node:fs";

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
const token = env.SUPABASE_ACCESS_TOKEN;

if (!projectRef) {
  console.error("NEXT_PUBLIC_SUPABASE_URL manquante ou mal formée dans .env.local.");
  process.exit(1);
}

if (!token) {
  console.error(
    "SUPABASE_ACCESS_TOKEN manquante dans .env.local.\n" +
      "Crée un Personal Access Token sur https://supabase.com/dashboard/account/tokens,\n" +
      "colle-le dans .env.local, puis relance npm run db:types.",
  );
  process.exit(1);
}

const response = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/types/typescript?included_schemas=public`,
  { headers: { Authorization: `Bearer ${token}` } },
);

if (!response.ok) {
  const body = await response.text();
  console.error(
    `L'API Management a répondu ${response.status}.\n` +
      (response.status === 401
        ? "Le token est invalide ou expiré : régénère-le sur https://supabase.com/dashboard/account/tokens."
        : body.slice(0, 500)),
  );
  process.exit(1);
}

const { types } = await response.json();
writeFileSync("src/types/db.ts", types, "utf8");
console.log(`src/types/db.ts régénéré (${types.split("\n").length} lignes).`);
