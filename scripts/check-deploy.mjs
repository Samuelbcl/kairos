/**
 * Vérifie que la configuration de déploiement passera la validation Vercel.
 *
 *   npm run check:deploy
 *
 * Motif : six crons horaires déclarés dans vercel.json faisaient rejeter le
 * déploiement AVANT le build. Aucun test local ne le voyait — ils tournent tous
 * contre localhost, où vercel.json n'est jamais lu. Deux jours à croire que le
 * dépôt n'était pas connecté.
 *
 * Le plan visé se règle par KAIROS_VERCEL_PLAN (hobby par défaut).
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PLANS = {
  hobby: { maxCrons: 2, minIntervalMinutes: 24 * 60, label: "Hobby" },
  pro: { maxCrons: 40, minIntervalMinutes: 1, label: "Pro" },
  enterprise: { maxCrons: 100, minIntervalMinutes: 1, label: "Enterprise" },
};

const planKey = (process.env.KAIROS_VERCEL_PLAN ?? "hobby").toLowerCase();
const plan = PLANS[planKey] ?? PLANS.hobby;

const problems = [];
const notes = [];

if (!existsSync("vercel.json")) {
  console.log("Pas de vercel.json : rien à vérifier.");
  process.exit(0);
}

let config;
try {
  config = JSON.parse(readFileSync("vercel.json", "utf8"));
} catch (error) {
  console.error(`vercel.json illisible : ${error.message}`);
  process.exit(1);
}

const crons = config.crons ?? [];

// --- Nombre de crons --------------------------------------------------------
if (crons.length > plan.maxCrons) {
  problems.push(
    `${crons.length} crons déclarés, le plan ${plan.label} en autorise ${plan.maxCrons}. ` +
      `Regroupe-les derrière un point d'entrée unique (voir /api/cron/run).`,
  );
}

/** Intervalle minimal entre deux exécutions, en minutes. */
function intervalMinutes(schedule) {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const [minute, hour, dayOfMonth, , dayOfWeek] = parts;

  const step = (field) => {
    const match = /^\*\/(\d+)$/.exec(field);
    return match ? Number(match[1]) : null;
  };

  if (step(minute)) return step(minute);
  if (minute.includes(",")) return null; // liste : trop variable pour trancher
  if (minute === "*") return 1;

  if (hour === "*") return 60;
  if (step(hour)) return step(hour) * 60;
  if (hour.includes(",")) return null;

  if (dayOfMonth === "*" && dayOfWeek === "*") return 24 * 60;
  return 24 * 60 * 7;
}

// --- Fréquences -------------------------------------------------------------
for (const cron of crons) {
  if (!cron.path?.startsWith("/api/")) {
    problems.push(`Chemin de cron suspect : ${cron.path}`);
    continue;
  }

  const minutes = intervalMinutes(cron.schedule ?? "");
  if (minutes === null) {
    notes.push(`${cron.path} — fréquence « ${cron.schedule} » non évaluée.`);
    continue;
  }

  if (minutes < plan.minIntervalMinutes) {
    problems.push(
      `${cron.path} tourne toutes les ${minutes} min ; le plan ${plan.label} ` +
        `n'autorise qu'une exécution par jour. Vercel refusera le déploiement.`,
    );
  }
}

// --- Les routes déclarées existent-elles ? ---------------------------------
for (const cron of crons) {
  const route = join("src/app", cron.path ?? "", "route.ts");
  if (!existsSync(route)) {
    problems.push(`${cron.path} est déclaré mais ${route} n'existe pas.`);
  }
}

// --- Routes de cron orphelines ---------------------------------------------
const cronDir = "src/app/api/cron";
if (existsSync(cronDir)) {
  const declared = new Set(crons.map((c) => c.path));
  const onDisk = readdirSync(cronDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `/api/cron/${entry.name}`);

  const orphans = onDisk.filter((path) => !declared.has(path));
  if (orphans.length) {
    // Pas une erreur : elles peuvent être appelées par le dispatcher ou à la main.
    notes.push(
      `Routes non planifiées (appel manuel ou via le dispatcher) : ${orphans.join(", ")}`,
    );
  }
}

// --- Rapport ----------------------------------------------------------------
console.log(`Configuration de déploiement — plan visé : ${plan.label}`);
console.log(`  ${crons.length} cron(s) déclaré(s), ${plan.maxCrons} autorisé(s).`);

for (const note of notes) console.log(`  note : ${note}`);

if (problems.length === 0) {
  console.log("\nvercel.json passera la validation.");
  process.exit(0);
}

console.error(`\n${problems.length} problème(s) qui feraient rejeter le déploiement :\n`);
for (const problem of problems) console.error(`  - ${problem}`);
process.exit(1);
