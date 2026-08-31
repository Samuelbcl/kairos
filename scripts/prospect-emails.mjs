/**
 * Constitue une liste de prospects à partir de sites d'entreprises réels.
 *
 *   npm run prospect -- domaines.txt
 *
 * Le fichier d'entrée contient un domaine par ligne. Pour chacun, le script
 * ouvre les pages où une entreprise publie ses coordonnées et relève ce qui y
 * est écrit : nom, adresse e-mail, téléphone.
 *
 * Rien n'est déduit. Une entreprise qui ne publie pas d'adresse n'entre pas
 * dans la liste — c'est toute la différence avec un fichier où l'on colle
 * `info@` devant un nom de domaine.
 *
 * Sortie : un CSV aux colonnes attendues par l'import de Kairos, et un rapport
 * détaillé indiquant pour chaque ligne la page exacte où la donnée a été lue.
 */
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage : node scripts/prospect-emails.mjs <domaines.txt>");
  process.exit(1);
}

const PATHS = [
  "/contact",
  "/contactez-nous",
  "/nous-contacter",
  "/fr/contact",
  "/contact-us",
  "/mentions-legales",
  "/",
];

const JUNK = [
  "example.com", "example.org", "domain.com", "email.com", "sentry.io",
  "wixpress.com", "wordpress.org", "squarespace.com", "godaddy.com", "cloudflare",
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".css", ".js",
];

const EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function emailsIn(html, domain) {
  const found = new Set();
  for (const raw of html.match(EMAIL) ?? []) {
    const email = raw
      .toLowerCase()
      .replace(/[.,;:)]+$/, "")
      // Numero de telephone colle a l'adresse dans le HTML.
      .replace(/^\d{2,4}(?:[.\s]\d{2,4})+(?=[a-z])/, "");
    if (JUNK.some((j) => email.includes(j))) continue;
    if (email.length > 70 || !email.includes("@")) continue;
    found.add(email);
  }
  const list = [...found];
  const own = list.filter((e) => e.split("@")[1].endsWith(domain.replace(/^www\./, "")));
  return own.length ? own : list;
}

function titleIn(html) {
  const t = /<title[^>]*>([^<]{1,160})<\/title>/i.exec(html)?.[1];
  if (!t) return "";
  return t
    .replace(/&amp;/g, "&")
    .replace(/&#8211;/g, "-")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Nom commercial : la partie du titre avant le premier separateur. */
function nameFrom(title, domain) {
  const fromDomain = () =>
    domain
      .replace(/\.(be|com|net|eu|fr)$/, "")
      .replace(/[-.]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const first = title.split(/[|–—•·]|(?: - )/)[0].trim();

  const cleaned = first
    // Les titres de page sont ecrits pour les moteurs de recherche, pas pour
    // nommer une societe : on retire les formules d'accueil et les mentions
    // geographiques, et on garde ce qui reste s'il ressemble a un nom.
    // Le  evite d'amputer « Contactez notre societe » en « ez notre societe ».
    .replace(/^(contactez[- ]nous|contactez|contact|nous contacter|accueil|bienvenue)\s*[:-]?\s*/i, "")
    .replace(/\s+(a|à|en|sur|dans)\s+(liege|liège|belgique|wallonie|province.*)$/i, "")
    .trim();

  const generic = /^(contact|accueil|home|document sans nom)$/i.test(cleaned);
  if (generic || cleaned.length < 3 || cleaned.length > 60) return fromDomain();
  return cleaned;
}

async function get(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": "KairosProspect/1.0 (constitution de liste B2B, contacts publies)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) return null;
    if (!(response.headers.get("content-type") ?? "").includes("html")) return null;
    return (await response.text()).slice(0, 400_000);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function inspect(domain) {
  for (const base of [`https://${domain}`, `https://www.${domain}`]) {
    let title = "";
    for (const path of PATHS) {
      const html = await get(`${base}${path}`);
      if (!html) continue;

      title ||= titleIn(html);
      const emails = emailsIn(html, domain);

      if (emails.length) {
        return {
          domain,
          name: nameFrom(title, domain),
          email: emails[0],
          website: base,
          source: `${base}${path}`,
          title,
        };
      }
    }
    if (title) return { domain, name: nameFrom(title, domain), title, website: base, status: "aucune adresse publiee" };
  }
  return { domain, status: "injoignable" };
}

const domains = readFileSync(file, "utf8")
  .split(/\r?\n/)
  .map((l) => l.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, ""))
  .filter((l) => l && !l.startsWith("#"));

console.log(`\n${domains.length} domaine(s) a examiner.\n`);

const results = [];
const queue = [...domains];
const workers = Array.from({ length: 6 }, async () => {
  while (queue.length) {
    const domain = queue.shift();
    results.push(await inspect(domain));
  }
});
await Promise.all(workers);

const usable = results.filter((r) => r.email);
const noEmail = results.filter((r) => r.status === "aucune adresse publiee");
const unreachable = results.filter((r) => r.status === "injoignable");

console.log("--- Adresses publiees par l'entreprise ---\n");
for (const r of usable.sort((a, b) => a.name.localeCompare(b.name))) {
  console.log(`  ${r.name}`);
  console.log(`      ${r.email}`);
  console.log(`      lu sur ${r.source}`);
}

console.log(`\n  ${usable.length} exploitables`);
console.log(`  ${noEmail.length} site(s) sans adresse publiee`);
console.log(`  ${unreachable.length} injoignable(s)`);

const csv = [
  "name,email,website,sector,city,country,tags",
  ...usable.map((r) =>
    [r.name, r.email, r.website, "", "", "Belgique", "prospect,verifie"]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  ),
].join("\n");
writeFileSync("prospects-verifies.csv", csv, "utf8");

const report = [
  "domaine,statut,nom,email,source,titre du site",
  ...results.map((r) =>
    [r.domain, r.status ?? "adresse trouvee", r.name ?? "", r.email ?? "", r.source ?? "", r.title ?? ""]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  ),
].join("\n");
writeFileSync("prospects-rapport.csv", report, "utf8");

console.log("\nprospects-verifies.csv  -> a importer dans Kairos (Contacts -> Importer)");
console.log("prospects-rapport.csv   -> le detail, y compris les echecs");
