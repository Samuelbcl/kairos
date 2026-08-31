/**
 * Tests des fonctions pures — celles qu'aucune suite ne touche parce qu'elles
 * ne parlent ni à la base ni au réseau.
 *
 *   npm run test:units
 *
 * Node exécute les fichiers TypeScript directement : on teste le vrai code,
 * pas une copie qui pourrait diverger.
 */
import { normalizeAppUrl } from "../src/lib/env.ts";
import { renderTemplate } from "../src/lib/email-variables.ts";

const results = [];
function expect(label, actual, expected) {
  const passed = actual === expected;
  results.push(passed);
  console.log(
    `  ${passed ? "OK   " : "ÉCHEC"}  ${label}` +
      (passed ? "" : `\n           obtenu : ${actual}\n           attendu : ${expected}`),
  );
}

// Le silence de la réparation ne doit pas polluer la sortie des tests.
const warn = console.warn;
console.warn = () => {};

console.log("\nnormalizeAppUrl");

expect("valeur absente", normalizeAppUrl(undefined), "http://localhost:3000");
expect("chaîne vide", normalizeAppUrl(""), "http://localhost:3000");
expect(
  "origine déjà correcte",
  normalizeAppUrl("https://kairos.vercel.app"),
  "https://kairos.vercel.app",
);

// Le cas qui a réellement cassé la production : Vercel affiche le domaine sans
// schéma, la redirect_uri partait sans https:// et Google répondait 400.
expect(
  "domaine sans schéma",
  normalizeAppUrl("kairos.vercel.app"),
  "https://kairos.vercel.app",
);
expect("localhost sans schéma", normalizeAppUrl("localhost:3000"), "http://localhost:3000");
expect("127.0.0.1 sans schéma", normalizeAppUrl("127.0.0.1:3000"), "http://127.0.0.1:3000");

expect(
  "barre oblique finale",
  normalizeAppUrl("https://kairos.vercel.app/"),
  "https://kairos.vercel.app",
);

// L'autre faute réelle : une URL copiée depuis la barre d'adresse.
expect(
  "chemin et paramètres collés",
  normalizeAppUrl("https://kairos.vercel.app/login?next=%2F"),
  "https://kairos.vercel.app",
);
expect("espaces autour", normalizeAppUrl("  https://kairos.vercel.app  "), "https://kairos.vercel.app");
expect("port conservé", normalizeAppUrl("http://localhost:3001"), "http://localhost:3001");
expect("valeur illisible", normalizeAppUrl("://"), "http://localhost:3000");

console.log("\nrenderTemplate");

const ctx = {
  company: { name: "Menuiserie Dupont" },
  contact: { first_name: "Marc", last_name: "" },
  salutation: "Bonjour Marc",
};

expect(
  "variable simple",
  renderTemplate("Bonjour {{contact.first_name}}", ctx),
  "Bonjour Marc",
);
expect(
  "salutation adaptee",
  renderTemplate("{{salutation}},", ctx),
  "Bonjour Marc,",
);

// Le cas qui imposait deux modeles : sans repli, on obtenait « Bonjour , ».
expect(
  "valeur de repli sur variable vide",
  renderTemplate("Bonjour {{contact.last_name|l'equipe}}", ctx),
  "Bonjour l'equipe",
);
expect(
  "valeur de repli sur variable absente",
  renderTemplate("Bonjour {{contact.nickname|tout le monde}}", ctx),
  "Bonjour tout le monde",
);
expect(
  "le repli est ignore quand la valeur existe",
  renderTemplate("{{company.name|une entreprise}}", ctx),
  "Menuiserie Dupont",
);
expect(
  "variable inconnue sans repli laisse un vide, jamais le jeton",
  renderTemplate("[{{inconnue}}]", ctx),
  "[]",
);
expect(
  "espaces autour du repli ignores",
  renderTemplate("{{vide|  secours  }}", ctx),
  "secours",
);
expect(
  "plusieurs variables sur une ligne",
  renderTemplate("{{salutation}}, ici {{company.name}}.", ctx),
  "Bonjour Marc, ici Menuiserie Dupont.",
);

console.warn = warn;

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} vérifications passées.`);
process.exitCode = failed ? 1 : 0;
