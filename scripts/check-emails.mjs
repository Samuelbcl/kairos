/**
 * Vérifie que les adresses e-mail des entreprises peuvent seulement exister.
 *
 *   npm run check:emails            (diagnostic, n'écrit rien)
 *   npm run check:emails -- --write (marque les adresses impossibles)
 *
 * Une adresse dont le domaine n'a aucun serveur de messagerie ne peut recevoir
 * aucun message : c'est une certitude, pas une estimation. C'est le seul
 * verdict qu'on puisse rendre sans écrire à quelqu'un.
 *
 * Ce que ce script NE dit PAS : si `info@domaine-qui-existe.be` est une vraie
 * boîte. Seul un rebond ou l'adresse publiée sur le site de l'entreprise le
 * dira. On ne devine jamais.
 *
 * Les requêtes DNS partent de la machine locale, pas d'un service tiers :
 * aucune donnée de prospection ne sort.
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
  .select("id, name, email")
  .is("deleted_at", null)
  .not("email", "is", null)
  .order("name");

if (error) {
  console.error(`Lecture impossible : ${error.message}`);
  process.exit(1);
}

const withEmail = companies.filter((c) => c.email?.includes("@"));
const domains = [...new Set(withEmail.map((c) => c.email.split("@")[1].toLowerCase()))];

console.log(`\n${withEmail.length} entreprises avec une adresse, ${domains.length} domaines distincts.`);
console.log("Interrogation DNS…\n");

/**
 * Interroge le DNS par HTTPS plutot qu'en UDP : le port 53 est ferme dans
 * certains environnements, et la reponse est la meme, elle fait autorite.
 */
async function query(domain, type) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(
        `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`,
        { headers: { accept: "application/dns-json" } },
      );
      if (response.ok) return await response.json();
    } catch {
      // reseau instable : on retente
    }
    await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
  }
  return null;
}

/**
 * Un domaine sans MX ni A ne peut recevoir aucun message.
 *
 * Status 3 = NXDOMAIN : le domaine n'existe pas du tout. Status 0 sans reponse
 * MX : le domaine existe mais ne declare aucun serveur de messagerie — on
 * verifie alors son enregistrement A, que certains petits hebergeurs utilisent
 * encore pour recevoir du courrier.
 */
async function canReceiveMail(domain) {
  const mx = await query(domain, "MX");
  if (!mx) return { ok: true, reason: "DNS injoignable", unknown: true };

  if (mx.Status === 3) return { ok: false, reason: "le domaine n'existe pas" };
  if (mx.Status === 0 && (mx.Answer ?? []).length > 0) return { ok: true, reason: "" };

  const a = await query(domain, "A");
  if (!a) return { ok: true, reason: "DNS injoignable", unknown: true };
  if (a.Status === 0 && (a.Answer ?? []).length > 0) return { ok: true, reason: "" };

  return { ok: false, reason: "aucun serveur de messagerie" };
}

// En parallele borne : on ne veut ni attendre dix minutes, ni saturer le resolveur.
const verdicts = new Map();
const queue = [...domains];
const workers = Array.from({ length: 12 }, async () => {
  while (queue.length) {
    const domain = queue.pop();
    verdicts.set(domain, await canReceiveMail(domain));
  }
});
await Promise.all(workers);

const impossible = withEmail.filter(
  (c) => verdicts.get(c.email.split("@")[1].toLowerCase()).ok === false,
);
const unknown = withEmail.filter(
  (c) => verdicts.get(c.email.split("@")[1].toLowerCase()).unknown,
);

console.log(`  ${withEmail.length - impossible.length} adresses dont le domaine peut recevoir du courrier`);
console.log(`  ${impossible.length} adresses impossibles — le domaine ne recoit rien`);
if (unknown.length) console.log(`  ${unknown.length} indeterminees (DNS momentanement indisponible)`);

if (impossible.length) {
  console.log("\nAdresses impossibles :\n");
  for (const c of impossible) {
    const reason = verdicts.get(c.email.split("@")[1].toLowerCase()).reason;
    console.log(`  ${c.email.padEnd(42)} ${reason.padEnd(28)} ${c.name}`);
  }

  const csv = [
    "entreprise,email,motif",
    ...impossible.map((c) => {
      const reason = verdicts.get(c.email.split("@")[1].toLowerCase()).reason;
      return `"${c.name.replace(/"/g, '""')}","${c.email}","${reason}"`;
    }),
  ].join("\n");
  writeFileSync("adresses-impossibles.csv", csv, "utf8");
  console.log("\nListe ecrite dans adresses-impossibles.csv");
}

if (write && impossible.length) {
  console.log("\nMarquage en base…");
  let marked = 0;

  for (const company of impossible) {
    const reason = verdicts.get(company.email.split("@")[1].toLowerCase()).reason;

    // On vide l'adresse mais on garde la trace : sans elle, on la reimporterait
    // au prochain passage sans savoir qu'elle avait deja echoue.
    const { data: current } = await admin
      .from("companies")
      .select("custom")
      .eq("id", company.id)
      .single();

    const { error: updateError } = await admin
      .from("companies")
      .update({
        email: null,
        custom: {
          ...(current?.custom ?? {}),
          email_invalide: company.email,
          email_invalide_motif: reason,
          email_invalide_le: new Date().toISOString().slice(0, 10),
        },
      })
      .eq("id", company.id);

    if (updateError) {
      console.error(`  ECHEC ${company.name} : ${updateError.message}`);
      continue;
    }
    marked += 1;
  }

  console.log(`  ${marked} fiches mises a jour.`);
} else if (impossible.length) {
  console.log("\nAucune ecriture. Relance avec --write pour appliquer.");
}
