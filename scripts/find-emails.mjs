/**
 * Trouve les adresses e-mail que les entreprises publient sur leur propre site.
 *
 *   npm run find:emails                      (toutes les fiches exploitables)
 *   npm run find:emails -- --limit 40        (un lot)
 *   npm run find:emails -- --only "CM Construction"
 *
 * Principe : ne rien inventer. Une adresse n'est retenue que si elle figure
 * littéralement sur une page du site de l'entreprise. L'URL exacte où elle a
 * été lue est conservée, pour qu'on puisse vérifier six mois plus tard.
 *
 * Ce que le script fait :
 *   1. déduit le domaine (site enregistré, adresse actuelle, ou adresse
 *      précédente conservée lors d'un nettoyage) ;
 *   2. ouvre quelques pages classiques — accueil, contact, mentions légales ;
 *   3. relève les adresses écrites dans la page ou dans un lien `mailto:` ;
 *   4. compare le nom affiché par le site au nom de la fiche, et signale les
 *      écarts : un domaine peut appartenir à une autre société que celle qu'on
 *      croit démarcher.
 *
 * Il écrit un fichier de propositions au format attendu par `fix:contacts`.
 * Rien n'est appliqué ici : on relit d'abord.
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

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1];
}

const env = loadEnv();
const limit = Number(arg("limit") ?? 0);
const only = arg("only");

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Pages où une entreprise publie son adresse, dans l'ordre de probabilité. */
const PATHS = [
  "/contact",
  "/contactez-nous",
  "/nous-contacter",
  "/fr/contact",
  "/contact-us",
  "/mentions-legales",
  "/",
];

/**
 * Adresses qu'on ne retient jamais : bibliothèques, exemples de gabarits,
 * outils de suivi. Elles polluent les pages sans appartenir à l'entreprise.
 */
const JUNK = [
  "example.com", "example.org", "domain.com", "email.com", "sentry.io",
  "wixpress.com", "wordpress.org", "squarespace.com", "godaddy.com",
  "@2x.png", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".css", ".js",
];

const EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/** Ne garde que ce qui ressemble vraiment à une adresse de contact. */
function extractEmails(html, domain) {
  const found = new Set();

  for (const raw of html.match(EMAIL) ?? []) {
    const email = raw
      .toLowerCase()
      .replace(/[.,;:)]+$/, "")
      // Un numero de telephone colle a l'adresse dans le HTML : « 58.88.07info@… »
      // devient « info@… ». Motif volontairement etroit — deux groupes de
      // chiffres separes par des points suivis de lettres — pour ne pas
      // amputer une adresse qui commencerait legitimement par des chiffres.
      .replace(/^\d{2,4}(?:[.\s]\d{2,4})+(?=[a-z])/, "");
    if (JUNK.some((j) => email.includes(j))) continue;
    if (email.length > 70) continue;
    found.add(email);
  }

  const list = [...found];

  // Une adresse sur le domaine du site est presque toujours la bonne ; celles
  // d'un autre domaine viennent souvent de l'agence web en pied de page.
  const sameDomain = list.filter((e) => e.split("@")[1].endsWith(domain));
  return sameDomain.length ? sameDomain : list;
}

/** Nom affiché par le site : sert à detecter un domaine qui n'est pas le bon. */
function extractTitle(html) {
  const title = /<title[^>]*>([^<]{1,160})<\/title>/i.exec(html)?.[1];
  return title ? title.replace(/\s+/g, " ").trim() : "";
}

/** Mots significatifs d'un nom, pour comparer sans se soucier de la forme. */
function words(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !["sa", "srl", "sprl", "the", "les", "des"].includes(w));
}

async function get(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // On se presente : un site doit pouvoir savoir qui le consulte.
        "user-agent": "KairosContactFinder/1.0 (verification d'adresses de contact)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) return null;
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("html")) return null;
    return (await response.text()).slice(0, 400_000);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Domaine exploitable : site enregistré, adresse actuelle, ou adresse nettoyée. */
function domainOf(company) {
  const custom = company.custom ?? {};
  const candidates = [
    company.website,
    company.email,
    custom.email_precedente,
    custom.email_invalide,
  ].filter(Boolean);

  for (const value of candidates) {
    const match = /@([a-z0-9.-]+\.[a-z]{2,})/i.exec(value) ?? /https?:\/\/(?:www\.)?([a-z0-9.-]+\.[a-z]{2,})/i.exec(value);
    if (match) return match[1].toLowerCase().replace(/^www\./, "");
  }
  return null;
}

async function inspect(company) {
  const domain = domainOf(company);
  if (!domain) return { company, status: "aucun domaine connu" };

  for (const base of [`https://${domain}`, `https://www.${domain}`]) {
    for (const path of PATHS) {
      const html = await get(`${base}${path}`);
      if (!html) continue;

      const emails = extractEmails(html, domain);
      const title = extractTitle(html);

      // Le nom du site correspond-il a celui de la fiche ?
      const fiche = words(company.name);
      const site = words(title);
      const overlap = fiche.filter((w) => site.includes(w)).length;
      const nameMatches = title ? overlap > 0 : null;

      if (emails.length) {
        return {
          company,
          status: "adresse trouvee",
          domain,
          email: emails[0],
          allEmails: emails,
          source: `${base}${path}`,
          title,
          nameMatches,
        };
      }

      // Page lue mais sans adresse : on continue, en retenant qu'un site existe.
      if (path === "/") {
        return { company, status: "site sans adresse publiee", domain, source: base, title, nameMatches };
      }
    }
  }

  return { company, status: "site injoignable", domain };
}

// --- Selection --------------------------------------------------------------

let query = admin
  .from("companies")
  .select("id, name, email, website, custom")
  .is("deleted_at", null)
  .order("name");

if (only) query = query.eq("name", only);

const { data: companies, error } = await query;
if (error) {
  console.error(`Lecture impossible : ${error.message}`);
  process.exit(1);
}

const targets = (limit ? companies.slice(0, limit) : companies).filter(domainOf);

console.log(`\n${targets.length} entreprise(s) a examiner.\n`);

const results = [];
const queue = [...targets];
let done = 0;

const workers = Array.from({ length: 6 }, async () => {
  while (queue.length) {
    const company = queue.shift();
    const result = await inspect(company);
    results.push(result);
    done += 1;
    if (done % 10 === 0) console.log(`  ${done}/${targets.length}…`);
  }
});
await Promise.all(workers);

// --- Rapport ----------------------------------------------------------------

const found = results.filter((r) => r.status === "adresse trouvee");
const noEmail = results.filter((r) => r.status === "site sans adresse publiee");
const unreachable = results.filter((r) => r.status === "site injoignable");
const mismatch = found.filter((r) => r.nameMatches === false);

console.log("\n--- Adresses publiees par l'entreprise ---\n");
for (const r of found.sort((a, b) => a.company.name.localeCompare(b.company.name))) {
  const flag = r.nameMatches === false ? "  [nom du site different]" : "";
  console.log(`  ${r.company.name}`);
  console.log(`      ${r.email}`);
  console.log(`      lu sur ${r.source}${flag}`);
}

console.log(`\n  ${found.length} adresse(s) publiee(s) et lue(s) sur le site`);
console.log(`  ${noEmail.length} site(s) sans adresse (formulaire uniquement)`);
console.log(`  ${unreachable.length} site(s) injoignable(s)`);
if (mismatch.length) {
  console.log(`  ${mismatch.length} fiche(s) dont le nom ne correspond pas au site — a verifier`);
}

// Une adresse hebergee sur un autre domaine que le site, ou un site dont le nom
// ne ressemble pas a la fiche : c'est peut-etre juste, mais ce n'est pas sur.
// Ces cas partent dans un fichier separe — les melanger reintroduirait
// exactement les suppositions qu'on cherche a eliminer.
function needsReview(r) {
  const sameDomain = r.email.split("@")[1].endsWith(r.domain);
  return !sameDomain || r.nameMatches === false;
}

const sure = found.filter((r) => !needsReview(r));
const review = found.filter(needsReview);

console.log(`  dont ${sure.length} sans reserve, et ${review.length} a confirmer par toi`);

const proposals = sure.map((r) => ({
  name: r.company.name,
  email: r.email,
  website: `https://${r.domain}`,
  source: `lue sur ${r.source}`,
  reason:
    r.company.email && r.company.email !== r.email
      ? `remplacee par l'adresse publiee sur ${r.source}`
      : `adresse publiee sur ${r.source}`,
}));

writeFileSync("adresses-trouvees.json", JSON.stringify(proposals, null, 2), "utf8");

const toReview = review.map((r) => ({
  name: r.company.name,
  email: r.email,
  website: `https://${r.domain}`,
  source: `lue sur ${r.source}`,
  reason: !r.email.split("@")[1].endsWith(r.domain)
    ? `adresse hebergee sur un autre domaine que ${r.domain} — a confirmer`
    : `le site s'intitule « ${r.title} », ce qui ne correspond pas a la fiche — a confirmer`,
}));
writeFileSync("adresses-a-verifier.json", JSON.stringify(toReview, null, 2), "utf8");

const csv = [
  "entreprise,statut,email,source,titre du site,nom concordant",
  ...results.map((r) =>
    [
      r.company.name,
      r.status,
      r.email ?? "",
      r.source ?? "",
      (r.title ?? "").replace(/"/g, "'"),
      r.nameMatches === null || r.nameMatches === undefined ? "" : r.nameMatches ? "oui" : "NON",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  ),
].join("\n");
writeFileSync("adresses-trouvees.csv", csv, "utf8");

console.log("\nadresses-trouvees.json  -> a relire, puis :");
console.log("  npm run fix:contacts -- adresses-trouvees.json          (simulation)");
console.log("  npm run fix:contacts -- adresses-trouvees.json --write  (appliquer)");
console.log("adresses-a-verifier.json -> les cas douteux, a trancher a la main");
console.log("adresses-trouvees.csv   -> le detail complet, y compris les echecs");
