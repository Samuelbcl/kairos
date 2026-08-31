/**
 * Envoie à la corbeille les fiches dont l'adresse n'est pas vérifiée.
 *
 *   npm run purge:unverified            (simulation)
 *   npm run purge:unverified -- --write (applique)
 *
 * Est considérée comme vérifiée une fiche dont l'adresse a été lue sur le site
 * de l'entreprise — c'est-à-dire qui porte `email_source` dans ses champs
 * personnalisés. Tout le reste part : adresses devinées, fiches sans adresse,
 * et sociétés dont le nom ne correspondait à aucune entreprise réelle.
 *
 * Suppression douce, comme dans l'application : `deleted_at` est renseigné, une
 * gâchette en base propage aux contacts et aux opportunités, et la corbeille
 * conserve tout trente jours. Rien n'est détruit ici.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(path = ".env.local") {
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
  return env;
}

const env = loadEnv();
const write = process.argv.includes("--write");

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: companies, error } = await admin
  .from("companies")
  .select("id, name, email, website, custom")
  .is("deleted_at", null)
  .order("name");

if (error) {
  console.error(`Lecture impossible : ${error.message}`);
  process.exit(1);
}

const verified = companies.filter((c) => c.custom?.email_source);
const doomed = companies.filter((c) => !c.custom?.email_source);

// Une entreprise réelle, au site confirmé, mais qui ne publie aucune adresse :
// elle part aussi, mais elle mérite d'être signalée à part. C'est de la donnée
// juste qu'on jette faute d'adresse, pas une fiche erronée.
const realButNoEmail = doomed.filter((c) => c.website);

console.log(`\n${companies.length} fiches actives`);
console.log(`  ${verified.length} vérifiées — conservées`);
console.log(`  ${doomed.length} non vérifiées — vers la corbeille`);
if (realButNoEmail.length) {
  console.log(
    `      dont ${realButNoEmail.length} entreprise(s) réelle(s) au site confirmé, sans adresse publiée`,
  );
}

// Une sauvegarde lisible, au cas où la corbeille serait vidée avant relecture.
const csv = [
  "entreprise,email,site,motif",
  ...doomed.map((c) =>
    [
      c.name,
      c.email ?? "",
      c.website ?? "",
      c.website ? "site confirmé mais aucune adresse publiée" : "adresse jamais vérifiée",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  ),
].join("\n");
writeFileSync("fiches-supprimees.csv", csv, "utf8");
console.log("\nSauvegarde écrite dans fiches-supprimees.csv");

if (!write) {
  // Pas de process.exit ici : couper le processus pendant que le client
  // Supabase a encore des connexions ouvertes fait planter Node sous Windows.
  console.log("\nAucune écriture. Relance avec --write pour envoyer à la corbeille.");
}

let sent = 0;
for (const company of write ? doomed : []) {
  const { error: deleteError } = await admin
    .from("companies")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", company.id);

  if (deleteError) {
    console.error(`  ECHEC ${company.name} : ${deleteError.message}`);
    continue;
  }
  sent += 1;
}

console.log(`\n${sent} fiche(s) envoyée(s) à la corbeille — récupérables 30 jours.`);
