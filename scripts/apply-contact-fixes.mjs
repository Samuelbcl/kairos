/**
 * Applique des corrections de contact vérifiées à la main.
 *
 *   npm run fix:contacts -- corrections.json           (simulation)
 *   npm run fix:contacts -- corrections.json --write   (applique)
 *
 * Le fichier attendu est une liste d'objets :
 *
 *   {
 *     "name": "Dumoulin Aero",          // doit correspondre exactement
 *     "email": "management@…",          // null pour vider
 *     "website": "https://…",           // optionnel
 *     "source": "page contact du site officiel",
 *     "reason": "domaine .be inexistant, le vrai domaine est en .com"
 *   }
 *
 * Deux principes :
 *
 *  1. Rien n'est perdu. L'ancienne adresse est conservée dans les champs
 *     personnalisés de la fiche, avec le motif et la date. Sans ça, un
 *     réimport la remettrait en place sans que personne ne sache qu'elle avait
 *     déjà échoué.
 *  2. Rien n'est deviné. La provenance de chaque valeur est écrite dans la
 *     fiche : on doit pouvoir savoir six mois plus tard d'où sort une adresse.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(path = ".env.local") {
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
  return env;
}

const file = process.argv[2];
const write = process.argv.includes("--write");

if (!file || file.startsWith("--")) {
  console.error("Usage : node scripts/apply-contact-fixes.mjs <corrections.json> [--write]");
  process.exit(1);
}

const env = loadEnv();
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const fixes = JSON.parse(readFileSync(file, "utf8"));
const today = new Date().toISOString().slice(0, 10);

console.log(`\n${fixes.length} correction(s) à appliquer${write ? "" : " — SIMULATION"}\n`);

let applied = 0;
let missing = 0;

for (const fix of fixes) {
  const { data: rows, error } = await admin
    .from("companies")
    .select("id, name, email, website, custom")
    .eq("name", fix.name)
    .is("deleted_at", null);

  if (error) {
    console.error(`  ERREUR  ${fix.name} : ${error.message}`);
    continue;
  }

  if (!rows?.length) {
    console.log(`  ABSENT  ${fix.name} — aucune fiche à ce nom`);
    missing += 1;
    continue;
  }

  if (rows.length > 1) {
    // Deux fiches du meme nom : corriger au hasard serait pire que ne rien faire.
    console.log(`  AMBIGU  ${fix.name} — ${rows.length} fiches portent ce nom, ignorée`);
    missing += 1;
    continue;
  }

  const company = rows[0];
  const custom = { ...(company.custom ?? {}) };

  if (company.email && company.email !== fix.email) {
    custom.email_precedente = company.email;
    custom.email_precedente_motif = fix.reason ?? "adresse invalide";
    custom.email_precedente_le = today;
  }
  if (fix.email) custom.email_source = fix.source ?? "vérifiée manuellement";

  const update = { email: fix.email ?? null, custom };
  if (fix.website) update.website = fix.website;

  const before = company.email ?? "(vide)";
  const after = fix.email ?? "(vidée)";
  console.log(`  ${fix.name}`);
  console.log(`      ${before}  ->  ${after}`);
  if (fix.website) console.log(`      site : ${fix.website}`);

  if (write) {
    const { error: updateError } = await admin
      .from("companies")
      .update(update)
      .eq("id", company.id);

    if (updateError) {
      console.error(`      ECHEC : ${updateError.message}`);
      continue;
    }
  }
  applied += 1;
}

console.log(
  `\n${applied} fiche(s) ${write ? "mises à jour" : "prêtes"}` +
    (missing ? `, ${missing} ignorée(s).` : "."),
);
if (!write) console.log("Relance avec --write pour appliquer.");
