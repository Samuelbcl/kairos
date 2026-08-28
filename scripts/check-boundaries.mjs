/**
 * Vérifie les frontières serveur / client, que TypeScript ne voit pas.
 *
 *   npm run check:boundaries
 *
 * Deux règles, toutes deux apprises à nos dépens :
 *
 * 1. Un fichier `"use server"` ne doit exporter que des fonctions async.
 *    Next remplace les autres exports par des références d'action côté client :
 *    une constante devient un stub, et casse au premier accès
 *    (`IMPORT_FIELDS.map is not a function`).
 *
 * 2. Un module `server-only` ne doit pas être importé par un fichier
 *    `"use client"`. Ça compile, puis explose en 500 à l'exécution.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = "src";
const problems = [];

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(full)) files.push(full);
  }
  return files;
}

const files = walk(ROOT);
const sources = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));

// Modules marqués server-only, pour la règle 2.
const serverOnly = new Set(
  files.filter((f) => /^\s*import\s+["']server-only["']/m.test(sources.get(f))),
);

function resolveImport(fromFile, specifier) {
  if (!specifier.startsWith("@/") && !specifier.startsWith(".")) return null;

  const base = specifier.startsWith("@/")
    ? join(ROOT, specifier.slice(2))
    : join(fromFile, "..", specifier);

  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    if (sources.has(candidate)) return candidate;
  }
  return null;
}

for (const [file, source] of sources) {
  const isUseServer = /^\s*["']use server["']/m.test(source);
  const isUseClient = /^\s*["']use client["']/m.test(source);

  // --- Règle 1 -------------------------------------------------------------
  if (isUseServer) {
    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
      // `export type` et `export interface` sont effacés à la compilation.
      const match = /^export\s+(const|let|var|class|function\s+(?!.*async))/.exec(line);
      if (!match) return;
      if (/^export\s+(type|interface)\b/.test(line)) return;

      problems.push({
        file,
        line: index + 1,
        rule: "use-server-exports",
        detail: `« ${line.trim().slice(0, 60)} » — un fichier "use server" ne doit exporter que des fonctions async. Déplace cette valeur dans un module neutre.`,
      });
    });
  }

  // --- Règle 2 -------------------------------------------------------------
  if (isUseClient) {
    const importRegex = /^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm;
    let match;
    while ((match = importRegex.exec(source)) !== null) {
      // Un import de type est effacé : il ne tire rien dans le bundle.
      if (/^\s*import\s+type\b/.test(match[0])) continue;

      const target = resolveImport(file, match[1]);
      if (target && serverOnly.has(target)) {
        problems.push({
          file,
          line: source.slice(0, match.index).split("\n").length,
          rule: "server-only-in-client",
          detail: `importe « ${match[1]} », marqué server-only. Extrais la partie partagée dans un module neutre.`,
        });
      }
    }
  }
}

if (problems.length === 0) {
  console.log(
    `Frontières serveur/client : ${sources.size} fichiers vérifiés, aucun problème.`,
  );
  process.exit(0);
}

console.error(`\n${problems.length} problème(s) de frontière serveur/client :\n`);
for (const problem of problems) {
  console.error(`  ${relative(".", problem.file)}:${problem.line}`);
  console.error(`    [${problem.rule}] ${problem.detail}\n`);
}
process.exit(1);
